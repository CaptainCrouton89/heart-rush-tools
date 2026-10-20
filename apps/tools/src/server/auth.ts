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

/** The Northlight auth for the origin this request arrived on (prod host, or localhost in dev). */
export function authFor(request: Request): NorthlightAuth {
  const origin = new URL(request.url).origin
  let auth = byOrigin.get(origin)
  if (!auth) {
    auth = createNorthlightAuth({
      clientId: env.CROUTER_CLIENT_ID,
      issuer: env.CROUTER_ISSUER,
      redirectUri: `${origin}/auth/callback`,
      privateKeyJson: env.CROUTER_APP_KEY_JSON,
      kv: env.AUTH_KV,
    })
    byOrigin.set(origin, auth)
  }
  return auth
}
