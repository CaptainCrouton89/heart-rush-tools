import { createFileRoute } from '@tanstack/react-router'
import { authFor } from '~/server/auth'

export const Route = createFileRoute('/auth/login')({
  server: { handlers: { GET: ({ request }) => authFor(request).login(request) } },
})
