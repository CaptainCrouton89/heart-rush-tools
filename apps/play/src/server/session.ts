import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { appendResponseHeader, getRequest } from '@tanstack/react-start/server'
import type { Session } from '@heartrush/northlight'
import { authFor } from './auth'

export type { Session }

/**
 * The signed-in person for `request` (resolved against the shared `AUTH_DB.session`; the local `user` row is
 * materialized by the lookup). When there is one, the session cookie is reissued on the response: it slides the
 * expiry when under 15 days remain and moves a pre-cutover host-only cookie to `.heartrush.party`.
 */
async function sessionOf(request: Request): Promise<Session | null> {
  const auth = authFor(request)
  const session = await auth.getSession(request)
  if (!session) return null
  const cookies = await auth.touchSession(request)
  for (const c of cookies ?? []) appendResponseHeader('set-cookie', c)
  return session
}

/** The path to return to after sign-in: the page itself, or for a server-function call the page that made it. */
function returnPath(request: Request): string {
  const url = new URL(request.url)
  const target = request.headers.get('x-tsr-serverFn') === 'true' && request.headers.get('referer') ? new URL(request.headers.get('referer')!) : url
  return target.origin === url.origin ? target.pathname + target.search : '/'
}

/**
 * The signed-in person for the current request, for route loaders, server functions and API handlers.
 * Signed out: a page navigation or server-function call throws a redirect to `/auth/login?returnTo=<page>` (the router
 * follows it); any other request (an API fetch) throws a 401 JSON response `{error, signIn: true}`.
 */
export async function requireUser(request: Request = getRequest()): Promise<Session> {
  const session = await sessionOf(request)
  if (session) return session
  const wantsPage = request.headers.get('x-tsr-serverFn') === 'true' || (request.headers.get('accept') ?? '').includes('text/html')
  if (wantsPage) throw redirect({ href: `/auth/login?returnTo=${encodeURIComponent(returnPath(request))}` })
  throw Response.json({ error: 'Sign in to continue.', signIn: true }, { status: 401 })
}

/** The signed-in person for the current request, or null. The root loader calls it on every page load. */
export const getSessionFn = createServerFn({ method: 'GET' }).handler(() => sessionOf(getRequest()))
