import { createFileRoute } from '@tanstack/react-router'
import { turnPrompt } from '~/encounter/prompt'
import { turnSchema, type StoredMessage } from '~/encounter/schema'
import { notFound, requireSession } from '~/server/api'
import { appendGmMessage, claim, finishRun, getParty, loadEncounter, recordRun, release } from '~/server/encounters'
import { cancelRun, needsSignIn, ndjsonResponse, RunCanceledError, startRun, waitForResult } from '~/server/runs'

/** Events streamed to the browser as newline-delimited JSON. */
export type EncounterEvent =
  | { type: 'started' }
  | { type: 'turn'; message: Extract<StoredMessage, { role: 'agent' }> }
  | { type: 'error'; message: string; signIn?: boolean; stopped?: boolean }

export const Route = createFileRoute('/api/encounters/$id/messages')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        const { userId } = who.session
        const body = (await request.json().catch(() => null)) as { text?: unknown } | null
        const text = typeof body?.text === 'string' ? body.text.trim() : ''
        if (!text) return Response.json({ error: 'Message text is required' }, { status: 400 })
        const enc = await loadEncounter(userId, params.id)
        if (!enc) return notFound()
        if (!(await claim(userId, enc.id))) {
          return Response.json({ error: 'A run is already active on this encounter' }, { status: 409 })
        }

        let messages: StoredMessage[]
        try {
          messages = await appendGmMessage(enc, text)
        } catch (error) {
          await release(userId, enc.id, 'starting')
          throw error
        }

        return ndjsonResponse<EncounterEvent>(request, async (send, signal) => {
          let runId: string | null = null
          let runtime
          try {
            runtime = await who.auth.runtimeFor(userId)
            const party = await getParty(userId)
            send({ type: 'started' })
            runId = await startRun(runtime, turnPrompt({ party, messages, document: enc.document }), turnSchema, signal)
            if (!(await recordRun(userId, enc.id, runId))) {
              // Stop or delete released the claim while the run was starting.
              await cancelRun(runtime, runId)
              send({ type: 'error', message: 'Stopped', stopped: true })
              return
            }
            const turn = await waitForResult(runtime, runId, turnSchema, signal)
            const { message } = await finishRun({ ...enc, messages }, runId, turn)
            send({ type: 'turn', message })
          } catch (error) {
            // Browser gone: waitForResult already cancelled the run. Either way the GM message stays.
            await release(userId, enc.id, runId ?? 'starting')
            if (signal.aborted) return
            if (error instanceof RunCanceledError) {
              send({ type: 'error', message: 'Stopped', stopped: true })
              return
            }
            console.error('encounter turn failed', error)
            if (runId && runtime) await cancelRun(runtime, runId) // a run left idle or waiting would otherwise keep running
            const signIn = needsSignIn(error)
            send({
              type: 'error',
              signIn,
              message: signIn
                ? 'Your Northlight connection needs to be renewed. Sign in again.'
                : error instanceof Error
                  ? error.message
                  : 'The encounter agent failed',
            })
          }
        })
      },
    },
  },
})
