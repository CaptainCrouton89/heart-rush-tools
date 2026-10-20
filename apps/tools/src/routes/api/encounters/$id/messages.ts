import { createFileRoute } from '@tanstack/react-router'
import type { ConnectedCrouter } from '@north-light/sdk'
import { turnPrompt } from '~/encounter/prompt'
import { turnSchema, type StoredMessage } from '~/encounter/schema'
import { notFound, requireSession } from '~/server/api'
import { appendGmMessage, cancelAndRelease, claim, finishRun, getParty, loadEncounter, recordRun, release } from '~/server/encounters'
import { needsSignIn, ndjsonResponse, resultOf, RunCanceledError, startRun } from '~/server/runs'

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
        const token = await claim(userId, enc.id)
        if (!token) return Response.json({ error: 'A run is already active on this encounter' }, { status: 409 })

        let messages: StoredMessage[] | null
        try {
          messages = await appendGmMessage(enc, token, text)
        } catch (error) {
          await release(userId, enc.id, token)
          throw error
        }
        if (!messages) return Response.json({ error: 'A run is already active on this encounter' }, { status: 409 })

        return ndjsonResponse<EncounterEvent>(request, async (send, signal) => {
          let runId: string | null = null
          let runtime: ConnectedCrouter | undefined
          try {
            runtime = await who.auth.runtimeFor(userId)
            const party = await getParty(userId)
            send({ type: 'started' })
            // The start is not tied to the browser's abort signal: an abort cannot leave a run that was created but never recorded.
            // The claim is the run's idempotency key and metadata, so a run whose id was lost is found again by it.
            runId = await startRun(runtime, turnPrompt({ party, messages, document: enc.document }), turnSchema, undefined, {
              key: token,
              metadata: { encounter: enc.id, claim: token },
            })
            const recorded = await recordRun(userId, enc.id, token, runId)
            if (!recorded) {
              // The encounter was deleted (or the claim recovered as lost) while the run was starting.
              await cancelAndRelease(runtime, userId, enc.id, token, runId)
              send({ type: 'error', message: 'Stopped', stopped: true })
              return
            }
            if (recorded.stopRequested || signal.aborted) {
              await cancelAndRelease(runtime, userId, enc.id, token, runId)
              send({ type: 'error', message: 'Stopped', stopped: true })
              return
            }
            const turn = resultOf(await runtime.runs.wait(runId, { signal }), turnSchema)
            const finished = await finishRun({ ...enc, messages }, token, turn)
            // Null: Stop released the claim after the run settled; Stop wins and the result is discarded.
            send(finished ? { type: 'turn', message: finished.message } : { type: 'error', message: 'Stopped', stopped: true })
          } catch (error) {
            // The GM message stays whatever happens. Release only once a started run is confirmed cancelled; if that fails the
            // claim stays, the encounter reads as running, and Stop (or a later page load) retries the cancellation.
            let cancelFailed = false
            try {
              if (!runtime || error instanceof RunCanceledError) await release(userId, enc.id, token) // no run, or one already settled as cancelled
              else await cancelAndRelease(runtime, userId, enc.id, token, runId) // finds a run whose start failed midway by its claim
            } catch (cancelError) {
              cancelFailed = true
              console.error('could not cancel encounter run', enc.id, cancelError)
            }
            if (signal.aborted) return
            if (error instanceof RunCanceledError) {
              send({ type: 'error', message: 'Stopped', stopped: true })
              return
            }
            console.error('encounter turn failed', error)
            const signIn = needsSignIn(error)
            const reason = error instanceof Error ? error.message : 'The encounter agent failed'
            send({
              type: 'error',
              signIn,
              message: signIn
                ? 'Your Northlight connection needs to be renewed. Sign in again.'
                : cancelFailed
                  ? `${reason} The run could not be cancelled; press Stop to try again.`
                  : reason,
            })
          }
        })
      },
    },
  },
})
