import { createFileRoute } from '@tanstack/react-router'
import type { z } from 'zod'
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

/** One run on the person's runtime. Aborting `signal` stops waiting; the SDK leaves the started run in place, so cancel it. */
async function runStage<T extends z.ZodType>(
  runtime: ConnectedCrouter,
  prompt: string,
  schema: T,
  signal: AbortSignal,
): Promise<z.output<T>> {
  const params = { prompt, output_schema: schema, scopes: ['crtr:llm', 'crtr:act'], deadline: RUN_DEADLINE }
  // runs.parse starts and waits in one call and never exposes the run id, so start and wait here to be able to cancel.
  const run = await runtime.runs.start(params, { signal })
  try {
    const settled = await runtime.runs.wait(run.run_id, { signal })
    const outcome = settled.status === 'settled' ? settled.outcome : undefined
    if (outcome?.kind === 'result') return schema.parse(settled.result)
    if (outcome?.reason === 'declined') {
      throw new Error(`The run declined: ${(outcome as { details?: { reason?: string } | null }).details?.reason ?? 'no reason given'}`)
    }
    throw new Error(`The run ended without a result: ${outcome?.reason ?? settled.status}`)
  } catch (error) {
    if (signal.aborted) {
      await runtime.runs.cancel(run.run_id).catch((e) => console.error('could not cancel run', run.run_id, e))
    }
    throw error
  }
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
        const abort = new AbortController()
        request.signal.addEventListener('abort', () => abort.abort(), { once: true })
        let open = true // false once the browser has gone: the controller is closed and must not be touched
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: MonsterEvent) => {
              if (open) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
            }
            try {
              const runtime = await auth.runtimeFor(session.userId)
              send({ type: 'stage', stage: 'analyzing' })
              // Stage 1: level, ability count and HP estimate (was gpt-5-nano generateText).
              const { analysis } = await runStage(runtime, analyzePrompt(concept), analysisSchema, abort.signal)
              if (abort.signal.aborted) return
              send({ type: 'stage', stage: 'generating' })
              // Stage 2: the full stat block (was gpt-5-mini generateObject).
              const monster = await runStage(runtime, generatePrompt(concept, analysis), monsterSchema, abort.signal)
              send({ type: 'result', monster })
            } catch (error) {
              if (abort.signal.aborted) return
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
              if (open) controller.close()
            }
          },
          cancel() {
            open = false
            abort.abort()
          },
        })
        return new Response(stream, {
          headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
        })
      },
    },
  },
})
