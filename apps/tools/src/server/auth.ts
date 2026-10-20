import { env } from 'cloudflare:workers'
import { createNorthlightAuth, type NorthlightAuth } from '@heartrush/northlight'

declare global {
  namespace Cloudflare {
    interface Env {
      /** Worker secret: the JSON text of the Northlight app's private key. */
      CROUTER_APP_KEY_JSON: string
    }
  }
}

const byOrigin = new Map<string, NorthlightAuth>()

/** The Northlight auth for an origin (the prod host, or localhost in dev). */
export function authForOrigin(origin: string): NorthlightAuth {
  let auth = byOrigin.get(origin)
  if (!auth) {
    auth = createNorthlightAuth({
      clientId: env.CROUTER_CLIENT_ID,
      issuer: env.CROUTER_ISSUER,
      redirectUri: `${origin}/auth/callback`,
      privateKeyJson: env.CROUTER_APP_KEY_JSON,
      db: env.DB,
    })
    byOrigin.set(origin, auth)
  }
  return auth
}

/** The Northlight auth for the origin this request arrived on. */
export const authFor = (request: Request) => authForOrigin(new URL(request.url).origin)
