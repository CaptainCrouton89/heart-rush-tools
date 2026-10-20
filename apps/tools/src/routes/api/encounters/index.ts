import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '~/server/api'
import { createEncounter, listEncounters } from '~/server/encounters'

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
        const body = (await request.json().catch(() => null)) as { text?: unknown } | null
        const text = typeof body?.text === 'string' ? body.text.trim() : ''
        if (!text) return Response.json({ error: 'Message text is required' }, { status: 400 })
        return Response.json({ id: await createEncounter(who.session.userId, text) })
      },
    },
  },
})
