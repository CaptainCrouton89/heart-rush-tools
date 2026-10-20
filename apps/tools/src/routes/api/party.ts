import { createFileRoute } from '@tanstack/react-router'
import { partySchema } from '~/encounter/schema'
import { requireSession } from '~/server/api'
import { getParty, saveParty } from '~/server/encounters'

export const Route = createFileRoute('/api/party')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        return Response.json(await getParty(who.session.userId))
      },
      PUT: async ({ request }) => {
        const who = await requireSession(request)
        if (!who.session) return who.response
        const parsed = partySchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) {
          return Response.json(
            { error: 'characters must be 1–10, bloodmarks 0–50 and note at most 500 characters' },
            { status: 400 },
          )
        }
        await saveParty(who.session.userId, parsed.data)
        return Response.json(parsed.data)
      },
    },
  },
})
