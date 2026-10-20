import { createFileRoute } from '@tanstack/react-router'

/** The campaign's live channel: a WebSocket upgrade, refused unless the signed-in user is a member (INV-AUTHZ). */
export const Route = createFileRoute('/campaigns/$id/live')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [{ requireUser }, { connectLive }, { env }] = await Promise.all([import('~/server/session'), import('~/server/live'), import('cloudflare:workers')])
        const { userId } = await requireUser(request)
        return connectLive(env, userId, params.id, request)
      },
    },
  },
})
