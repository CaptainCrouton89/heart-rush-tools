import handler from '@tanstack/react-start/server-entry'
import { env } from 'cloudflare:workers'
import { authFor, authForOrigin } from '~/server/auth'
import { connectLive } from '~/server/live'

// A Durable Object class must be a named export of the Worker's entry module.
export { CampaignChannel } from '~/server/campaign-channel'
// The tools Worker's service-binding entrypoint (spec §7.4); no route reaches it.
export { ToolsApi } from '~/server/tools-api-entrypoint'

const LIVE_PATH = /^\/campaigns\/([^/]+)\/live\/?$/

/**
 * The campaign's live channel (`GET /campaigns/:id/live`, INV-AUTHZ), answered here and never by TanStack Start: the Durable Object's
 * 101 carries a `webSocket` that the framework's response handling cannot re-wrap ("Unable to reconcile response"), so it goes straight out.
 * Signed out is 401 JSON; a session is only read, never re-issued, because an upgrade has no response headers worth setting.
 */
async function liveChannel(request: Request, campaignId: string): Promise<Response> {
  const session = await authFor(request).getSession(request)
  if (!session) return Response.json({ error: 'Sign in to continue.', signIn: true }, { status: 401 })
  return connectLive(env, session.userId, campaignId, request)
}

/** The Worker's entry: the live channel, TanStack Start's fetch handler for everything else, and the daily Northlight maintenance cron. */
export default {
  fetch(request: Request, ...rest: unknown[]) {
    const live = request.method === 'GET' ? LIVE_PATH.exec(new URL(request.url).pathname) : null
    if (live) return liveChannel(request, decodeURIComponent(live[1]!))
    return (handler.fetch as (...args: unknown[]) => unknown)(request, ...rest)
  },
  async scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    // Any registered origin works: maintenance never uses the redirect URI.
    // Play's `sessionDb` is tools' database, so this purges only play's own pending sign-ins and refreshes play's connections.
    ctx.waitUntil(
      authForOrigin(`https://${env.APP_HOST}`)
        .runMaintenance()
        .then((result) => console.log('northlight maintenance', JSON.stringify(result, (_k, v) => (v instanceof Error ? v.message : v)))),
    )
  },
}
