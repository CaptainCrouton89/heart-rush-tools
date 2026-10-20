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
    const { hostname } = new URL(origin)
    auth = createNorthlightAuth({
      clientId: env.CROUTER_CLIENT_ID,
      issuer: env.CROUTER_ISSUER,
      redirectUri: `${origin}/auth/callback`,
      privateKeyJson: env.CROUTER_APP_KEY_JSON,
      // Play's own rows: OAuth pending sign-ins, the fenced connection store, a copy of each user's profile for foreign keys.
      db: env.DB,
      // Shared with tools: `AUTH_DB.session` is the only session authority; play's own `session` table stays empty.
      sessionDb: env.AUTH_DB,
      scopes: ['openid', 'profile', 'email', 'crtr:llm', 'crtr:act'],
      // One sign-in across tools.heartrush.party and play.heartrush.party (host-only on localhost).
      ...(hostname === 'heartrush.party' || hostname.endsWith('.heartrush.party') ? { cookieDomain: '.heartrush.party' } : {}),
    })
    byOrigin.set(origin, auth)
  }
  return auth
}

/** The Northlight auth for the origin this request arrived on. */
export const authFor = (request: Request) => authForOrigin(new URL(request.url).origin)
