import handler from '@tanstack/react-start/server-entry'
import { env } from 'cloudflare:workers'
import { authForOrigin } from '~/server/auth'

// A Durable Object class must be a named export of the Worker's entry module.
export { CampaignChannel } from '~/server/campaign-channel'
// The tools Worker's service-binding entrypoint (spec §7.4); no route reaches it.
export { ToolsApi } from '~/server/tools-api-entrypoint'

/** The Worker's entry: TanStack Start's fetch handler plus the daily Northlight maintenance cron. */
export default {
  fetch: handler.fetch,
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
