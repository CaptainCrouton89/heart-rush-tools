import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '~/server/api'
import { listSessions, PlayError, playErrorResponse } from '~/server/play'

/** The sessions of one of the GM's campaigns on play.heartrush.party, for Add to campaign. Play answers 403 unless the user is its GM. */
export const Route = createFileRoute('/api/campaigns/$id/sessions')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        try {
          return Response.json(await listSessions(who.session.userId, params.id))
        } catch (error) {
          if (error instanceof PlayError) return playErrorResponse(error)
          throw error
        }
      },
    },
  },
})
