import { createFileRoute } from '@tanstack/react-router'
import { authFor } from '~/server/auth'
import { needsSignIn } from '@heartrush/northlight/runs'
import { ndjsonResponse, runSchema } from '~/server/runs'
import { generateImage, storeImage } from '~/server/image'
import { analysisSchema, generatedMonsterSchema } from '~/monster/schema'
import { analyzePrompt, generatePrompt, monsterImagePrompt } from '~/monster/prompts'

/** Events streamed to the browser as newline-delimited JSON. With `image: true`, an `image` event follows the `result`. */
export type MonsterEvent =
  | { type: 'stage'; stage: 'analyzing' | 'generating' }
  | { type: 'result'; monster: unknown }
  | { type: 'image'; url: string | null }
  | { type: 'error'; message: string; signIn?: boolean }

export const Route = createFileRoute('/api/monster')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = authFor(request)
        const session = await auth.getSession(request)
        if (!session) return Response.json({ error: 'Sign in to generate monsters.' }, { status: 401 })
        const body = (await request.json().catch(() => null)) as { concept?: unknown; image?: unknown } | null
        const concept = typeof body?.concept === 'string' ? body.concept.trim() : ''
        if (!concept) return Response.json({ error: 'Monster concept is required' }, { status: 400 })
        const withImage = body?.image === true

        return ndjsonResponse<MonsterEvent>(request, async (send, signal) => {
          let monster
          try {
            const runtime = await auth.runtimeFor(session.userId)
            send({ type: 'stage', stage: 'analyzing' })
            // Stage 1: level, ability count and HP estimate (was gpt-5-nano generateText).
            const { analysis } = await runSchema(runtime, analyzePrompt(concept), analysisSchema, signal)
            if (signal.aborted) return
            send({ type: 'stage', stage: 'generating' })
            // Stage 2: the full stat block (was gpt-5-mini generateObject).
            monster = await runSchema(runtime, generatePrompt(concept, analysis), generatedMonsterSchema, signal)
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
            return
          }
          if (!withImage || signal.aborted) return
          // Stage 3, after the stat block is already on screen. A failure here is reported as `url: null` and never touches the monster.
          try {
            const url = await storeImage(await generateImage(monsterImagePrompt(monster.description), signal))
            send({ type: 'image', url })
          } catch (error) {
            if (signal.aborted) return
            console.error('monster image generation failed', error)
            send({ type: 'image', url: null })
          }
        })
      },
    },
  },
})
