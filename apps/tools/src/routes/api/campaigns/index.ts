import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '~/server/api'
import { newestCampaignId } from '~/server/encounters'
import { listGmCampaigns, playAvailable, PlayError, playErrorResponse } from '~/server/play'

/**
 * The campaigns on play.heartrush.party where the signed-in user is GM, and the campaign of their newest encounter (the picker's
 * starting choice). `{available: false}` while tools has no `PLAY` binding: the client then shows neither the picker nor Add to campaign.
 */
export const Route = createFileRoute('/api/campaigns/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        if (!playAvailable()) return Response.json({ available: false })
        const { userId } = who.session
        try {
          const [campaigns, current] = await Promise.all([listGmCampaigns(userId), newestCampaignId(userId)])
          return Response.json({ available: true, campaigns, current: campaigns.some((c) => c.id === current) ? current : null })
        } catch (error) {
          if (error instanceof PlayError) return playErrorResponse(error)
          throw error
        }
      },
    },
  },
})
