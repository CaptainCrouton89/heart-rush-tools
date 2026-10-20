import handler from '@tanstack/react-start/server-entry'
import { env } from 'cloudflare:workers'
import { authForOrigin } from '~/server/auth'

/** The Worker's entry: TanStack Start's fetch handler plus the daily Northlight maintenance cron. */
export default {
  fetch: handler.fetch,
  async scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    // Any registered origin works: maintenance never uses the redirect URI.
    ctx.waitUntil(
      authForOrigin(`https://${env.APP_HOST}`)
        .runMaintenance()
        .then((result) => console.log('northlight maintenance', JSON.stringify(result, (_k, v) => (v instanceof Error ? v.message : v)))),
    )
  },
}
