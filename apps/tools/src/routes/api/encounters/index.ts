import { createFileRoute } from '@tanstack/react-router'
import { campaignIdOf, requireSession } from '~/server/api'
import { createEncounter, listEncounters } from '~/server/encounters'
import { assertGmOf, PlayError, playErrorResponse } from '~/server/play'

export const Route = createFileRoute('/api/encounters/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        return Response.json(await listEncounters(who.session.userId))
      },
      POST: async ({ request }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        const body = (await request.json().catch(() => null)) as { text?: unknown; campaignId?: unknown } | null
        const text = typeof body?.text === 'string' ? body.text.trim() : ''
        if (!text) return Response.json({ error: 'Message text is required' }, { status: 400 })
        // A play campaign id the user is GM of, or absent/null for the typed party. Play checks the GM role again each time a run reads it.
        const campaignId = campaignIdOf(body?.campaignId ?? null)
        if (campaignId === undefined) {
          return Response.json({ error: 'campaignId must be a campaign id or null' }, { status: 400 })
        }
        if (campaignId) {
          try {
            await assertGmOf(who.session.userId, campaignId)
          } catch (error) {
            if (error instanceof PlayError) return playErrorResponse(error)
            throw error
          }
        }
        return Response.json({ id: await createEncounter(who.session.userId, text, campaignId) })
      },
    },
  },
})
