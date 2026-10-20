import { createFileRoute } from '@tanstack/react-router'
import { refusalOf, type ConnectedCrouter } from '@north-light/sdk'
import { authFor } from '~/server/auth'
import { analysisSchema, monsterSchema } from '~/monster/schema'
import { analyzePrompt, generatePrompt } from '~/monster/prompts'

/** Events streamed to the browser as newline-delimited JSON. */
export type MonsterEvent =
  | { type: 'stage'; stage: 'analyzing' | 'generating' }
  | { type: 'result'; monster: unknown }
  | { type: 'error'; message: string; signIn?: boolean }

const RUN_DEADLINE = '15m'

async function runStage<T extends typeof analysisSchema | typeof monsterSchema>(
  runtime: ConnectedCrouter,
  prompt: string,
  schema: T,
  signal: AbortSignal,
) {
  const outcome = await runtime.runs.parse(
    { prompt, output_schema: schema, scopes: ['crtr:llm', 'crtr:act'], deadline: RUN_DEADLINE },
    { signal },
  )
  if (outcome.kind === 'result') return outcome.output_parsed
  if (outcome.reason === 'declined') {
    throw new Error(`The run declined: ${outcome.details?.reason ?? 'no reason given'}`)
  }
  throw new Error(`The run ended without a result: ${outcome.reason}`)
}

export const Route = createFileRoute('/api/monster')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = authFor(request)
        const session = await auth.getSession(request)
        if (!session) return Response.json({ error: 'Sign in to generate monsters.' }, { status: 401 })
        const body = (await request.json().catch(() => null)) as { concept?: unknown } | null
        const concept = typeof body?.concept === 'string' ? body.concept.trim() : ''
        if (!concept) return Response.json({ error: 'Monster concept is required' }, { status: 400 })

        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: MonsterEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
            try {
              const runtime = await auth.runtimeFor(session.userId)
              send({ type: 'stage', stage: 'analyzing' })
              // Stage 1: level, ability count and HP estimate (was gpt-5-nano generateText).
              const { analysis } = await runStage(runtime, analyzePrompt(concept), analysisSchema, request.signal)
              send({ type: 'stage', stage: 'generating' })
              // Stage 2: the full stat block (was gpt-5-mini generateObject).
              const monster = await runStage(runtime, generatePrompt(concept, analysis), monsterSchema, request.signal)
              send({ type: 'result', monster })
            } catch (error) {
              console.error('monster generation failed', error)
              const needsSignIn = refusalOf(error) !== null || (error as { code?: string })?.code === 'not_connected'
              send({
                type: 'error',
                signIn: needsSignIn,
                message: needsSignIn
                  ? 'Your Northlight connection needs to be renewed. Sign in again.'
                  : error instanceof Error
                    ? error.message
                    : 'Failed to generate monster',
              })
            } finally {
              controller.close()
            }
          },
        })
        return new Response(stream, {
          headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
        })
      },
    },
  },
})
