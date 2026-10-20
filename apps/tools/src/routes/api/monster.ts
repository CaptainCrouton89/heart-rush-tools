import { createFileRoute } from '@tanstack/react-router'
import { authFor } from '~/server/auth'
import { needsSignIn, ndjsonResponse, runSchema } from '~/server/runs'
import { analysisSchema, monsterSchema } from '~/monster/schema'
import { analyzePrompt, generatePrompt } from '~/monster/prompts'

/** Events streamed to the browser as newline-delimited JSON. */
export type MonsterEvent =
  | { type: 'stage'; stage: 'analyzing' | 'generating' }
  | { type: 'result'; monster: unknown }
  | { type: 'error'; message: string; signIn?: boolean }

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

        return ndjsonResponse<MonsterEvent>(request, async (send, signal) => {
          try {
            const runtime = await auth.runtimeFor(session.userId)
            send({ type: 'stage', stage: 'analyzing' })
            // Stage 1: level, ability count and HP estimate (was gpt-5-nano generateText).
            const { analysis } = await runSchema(runtime, analyzePrompt(concept), analysisSchema, signal)
            if (signal.aborted) return
            send({ type: 'stage', stage: 'generating' })
            // Stage 2: the full stat block (was gpt-5-mini generateObject).
            const monster = await runSchema(runtime, generatePrompt(concept, analysis), monsterSchema, signal)
            send({ type: 'result', monster })
          } catch (error) {
            if (signal.aborted) return
            console.error('monster generation failed', error)
            const signIn = needsSignIn(error)
            send({
              type: 'error',
              signIn,
              message: signIn
                ? 'Your Northlight connection needs to be renewed. Sign in again.'
                : error instanceof Error
                  ? error.message
                  : 'Failed to generate monster',
            })
          }
        })
      },
    },
  },
})
