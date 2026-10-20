import { createFileRoute } from '@tanstack/react-router'
import { notFound, requireSession } from '~/server/api'
import { loadEncounter } from '~/server/encounters'
import { attachEncounter, PlayError, playErrorResponse } from '~/server/play'

/**
 * Add to campaign (spec §7.3): attach this finished encounter to a session of one of the GM's campaigns on play.heartrush.party.
 * Play stores the id and title and links the session row to https://tools.heartrush.party/encounter-builder/<id>.
 */
export const Route = createFileRoute('/api/encounters/$id/attach')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        const { userId } = who.session
        const body = (await request.json().catch(() => null)) as { campaignId?: unknown; sessionId?: unknown } | null
        const { campaignId, sessionId } = body ?? {}
        if (typeof campaignId !== 'string' || !campaignId || typeof sessionId !== 'string' || !sessionId) {
          return Response.json({ error: 'campaignId and sessionId are required' }, { status: 400 })
        }
        const enc = await loadEncounter(userId, params.id)
        if (!enc) return notFound()
        if (!enc.document) return Response.json({ error: 'Only a finished encounter can be added to a campaign' }, { status: 409 })
        try {
          await attachEncounter(userId, campaignId, sessionId, { encounterId: enc.id, title: enc.document.title })
        } catch (error) {
          if (error instanceof PlayError) return playErrorResponse(error)
          throw error
        }
        return Response.json({ ok: true })
      },
    },
  },
})
