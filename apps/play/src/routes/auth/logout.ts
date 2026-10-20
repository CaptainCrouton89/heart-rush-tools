import { createFileRoute } from '@tanstack/react-router'
import { authFor } from '~/server/auth'

export const Route = createFileRoute('/auth/logout')({
  server: { handlers: { POST: ({ request }) => authFor(request).logout(request) } },
})
