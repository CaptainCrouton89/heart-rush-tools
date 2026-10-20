import { createFileRoute } from '@tanstack/react-router'
import { authFor } from '~/server/auth'

export const Route = createFileRoute('/auth/callback')({
  server: { handlers: { GET: ({ request }) => authFor(request).callback(request) } },
})
