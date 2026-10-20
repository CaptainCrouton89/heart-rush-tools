import { createFileRoute } from '@tanstack/react-router'
import { notFound, requireSession } from '~/server/api'
import { cancelAndRelease, loadEncounter, requestStop, STARTING_STALE_MS } from '~/server/encounters'

const STOP_WAIT_MS = 15_000
const POLL_MS = 400

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Stop the encounter's run and answer only once it is confirmed cancelled and the claim released.
 * - 200 `{ok: true, stopped}`: nothing is running now (`stopped` is whether this call ended a run).
 * - 502 `{ok: false, error, retry: true}`: the cancellation could not be confirmed; the encounter stays running, Stop again.
 * - 202 `{ok: false, stopping: true}`: the run was still starting after 15 seconds; Stop was recorded and the starting request
 *   will cancel the run, so the encounter is still running until a later load shows otherwise.
 */
export const Route = createFileRoute('/api/encounters/$id/stop')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        const { userId } = who.session
        let waited = false // a Stop that waited on a starting run is what ended it
        const deadline = Date.now() + STOP_WAIT_MS
        for (;;) {
          const enc = await loadEncounter(userId, params.id)
          if (!enc) return notFound()
          const token = enc.claim
          if (!token) return Response.json({ ok: true, stopped: waited })
          const starting = enc.active_run_id === null
          if (!starting || Date.now() - Date.parse(enc.updated_at) > STARTING_STALE_MS) {
            // A claim that never recorded a run id and is stale has lost its request: cancelAndRelease finds its run by claim.
            try {
              await cancelAndRelease(await who.auth.runtimeFor(userId), userId, enc.id, token, enc.active_run_id)
            } catch (error) {
              console.error('could not cancel encounter run', enc.id, error)
              return Response.json(
                { ok: false, error: 'The run could not be stopped. Try again.', retry: true },
                { status: 502 },
              )
            }
            return Response.json({ ok: true, stopped: true })
          }
          // The run is still starting: its own request cancels it as soon as it knows the run id.
          waited = (await requestStop(userId, enc.id, token)) || waited
          if (Date.now() >= deadline) return Response.json({ ok: false, stopping: true }, { status: 202 })
          await sleep(POLL_MS)
        }
      },
    },
  },
})
