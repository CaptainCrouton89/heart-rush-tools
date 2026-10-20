import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { authFor } from './auth'

/** The signed-in person for the current request, or null. */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  return authFor(request).getSession(request)
})
