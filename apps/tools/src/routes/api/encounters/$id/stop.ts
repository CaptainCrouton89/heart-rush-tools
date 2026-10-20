import { createFileRoute } from '@tanstack/react-router'
import { notFound, requireSession } from '~/server/api'
import { loadEncounter, release, STARTING } from '~/server/encounters'
import { cancelRun } from '~/server/runs'

export const Route = createFileRoute('/api/encounters/$id/stop')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        const { userId } = who.session
        const enc = await loadEncounter(userId, params.id)
        if (!enc) return notFound()
        const runId = enc.active_run_id
        let run
        if (runId) {
          // Release first: the waiting request then sees its claim gone. A run still starting is cancelled by its own request.
          await release(userId, enc.id, runId)
          if (runId !== STARTING) run = await cancelRun(await who.auth.runtimeFor(userId), runId)
        }
        return Response.json({ ok: true, stopped: runId !== null, run: run && { status: run.status, outcome: run.outcome?.reason } })
      },
    },
  },
})
