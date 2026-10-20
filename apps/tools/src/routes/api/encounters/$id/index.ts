import { createFileRoute } from '@tanstack/react-router'
import { notFound, requireSession } from '~/server/api'
import { deleteEncounter, loadEncounter, reconcile } from '~/server/encounters'
import { cancelRunConfirmed } from '~/server/runs'

export const Route = createFileRoute('/api/encounters/$id/')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        const { userId } = who.session
        const found = await loadEncounter(userId, params.id)
        if (!found) return notFound()
        // Adopts a run that settled while no request was waiting on it (closed tab, Worker restart).
        const enc = await reconcile(() => who.auth.runtimeFor(userId), found).catch((error) => {
          console.error('could not reconcile encounter run', params.id, error)
          return found
        })
        return Response.json({
          id: enc.id,
          title: enc.title,
          messages: enc.messages,
          document: enc.document,
          running: enc.claim !== null,
        })
      },
      DELETE: async ({ request, params }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        const { userId } = who.session
        const enc = await loadEncounter(userId, params.id)
        if (!enc) return notFound()
        // A run still starting finds its claim gone and cancels itself. A run that cannot be confirmed cancelled keeps the encounter.
        if (enc.active_run_id) {
          try {
            await cancelRunConfirmed(await who.auth.runtimeFor(userId), enc.active_run_id)
          } catch (error) {
            console.error('could not cancel encounter run', enc.id, error)
            return Response.json({ ok: false, error: 'The run could not be stopped. Try again.', retry: true }, { status: 502 })
          }
        }
        await deleteEncounter(userId, params.id)
        return Response.json({ ok: true })
      },
    },
  },
})
