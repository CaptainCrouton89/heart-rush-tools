import { createFileRoute } from '@tanstack/react-router'
import { campaignIdOf, notFound, requireSession } from '~/server/api'
import { deleteEncounter, loadEncounter, reconcile, setEncounterCampaign } from '~/server/encounters'
import { assertGmOf, PlayError, playErrorResponse } from '~/server/play'
import { cancelRunConfirmed } from '@heartrush/northlight/runs'

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
          campaignId: enc.campaign_id,
        })
      },
      /** `{campaignId}`: a play campaign the user is GM of, which the next runs read, or null for the typed party. */
      PATCH: async ({ request, params }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        const { userId } = who.session
        const body = (await request.json().catch(() => null)) as { campaignId?: unknown } | null
        const campaignId = campaignIdOf(body?.campaignId)
        if (campaignId === undefined) {
          return Response.json({ error: 'campaignId must be a campaign id or null' }, { status: 400 })
        }
        if (!(await loadEncounter(userId, params.id))) return notFound()
        if (campaignId) {
          try {
            await assertGmOf(userId, campaignId)
          } catch (error) {
            if (error instanceof PlayError) return playErrorResponse(error)
            throw error
          }
        }
        if (!(await setEncounterCampaign(userId, params.id, campaignId))) return notFound()
        return Response.json({ ok: true })
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
