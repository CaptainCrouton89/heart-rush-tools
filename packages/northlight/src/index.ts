import {
  OAuth2Client,
  authorizationRefusalOf,
  profileFromClaims,
  type ConnectedCrouter,
} from '@north-light/sdk'
import { KvConnectionStore, type KV } from './kv-store'

export type { KV } from './kv-store'
export { KvConnectionStore } from './kv-store'

export interface NorthlightAuthOptions {
  clientId: string
  issuer: string
  /** Absolute callback URL; must be one of the app's registered redirect URIs. */
  redirectUri: string
  /** The app's private signing key: the JSON text of `local/app-key.json` (secret `CROUTER_APP_KEY_JSON`). */
  privateKeyJson: string
  /** One KV namespace per app. Holds connections, sessions and in-flight sign-ins under distinct key prefixes. */
  kv: KV
  /** Scopes requested at sign-in. Default `['openid', 'profile', 'crtr:llm', 'crtr:act']`. */
  scopes?: string[]
  /** Session cookie name. Default `hr_session`. */
  cookieName?: string
  /** Session lifetime in seconds. Default 30 days. */
  sessionTtlSeconds?: number
  /** Where `/auth/login` returns to when no `returnTo` is given, and where `/auth/logout` goes. Default `/`. */
  homePath?: string
}

export interface Session {
  userId: string
  displayName: string
}

interface PendingSignIn {
  codeVerifier: string
  nonce: string
  returnTo: string
}

const PENDING_TTL_SECONDS = 600

export function createNorthlightAuth(options: NorthlightAuthOptions) {
  const {
    kv,
    scopes = ['openid', 'profile', 'crtr:llm', 'crtr:act'],
    cookieName = 'hr_session',
    sessionTtlSeconds = 60 * 60 * 24 * 30,
    homePath = '/',
  } = options

  const oauth = new OAuth2Client({
    clientId: options.clientId,
    issuer: options.issuer,
    redirectUri: options.redirectUri,
    privateKey: JSON.parse(options.privateKeyJson),
    store: new KvConnectionStore(kv),
  })

  const randomId = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  const safePath = (value: string | null) => (value && /^\/(?![/\\])/.test(value) ? value : homePath)

  const cookie = (request: Request, value: string, maxAge: number) =>
    [
      `${cookieName}=${value}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAge}`,
      ...(new URL(request.url).protocol === 'https:' ? ['Secure'] : []),
    ].join('; ')

  const redirect = (location: string, setCookie?: string) => {
    const headers = new Headers({ location })
    if (setCookie) headers.append('set-cookie', setCookie)
    return new Response(null, { status: 303, headers })
  }

  const page = (status: number, title: string, body: string) =>
    new Response(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
        `<body style="font-family:system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1rem;line-height:1.5"><h1>${title}</h1>${body}</body></html>`,
      { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
    )

  const sessionIdOf = (request: Request) => {
    const header = request.headers.get('cookie') ?? ''
    for (const part of header.split(';')) {
      const [name, ...rest] = part.trim().split('=')
      if (name === cookieName) return rest.join('=') || null
    }
    return null
  }

  return {
    /** The underlying SDK client, for anything not covered here (refreshIdleConnections, accountAppUrl…). */
    oauth,

    /** GET /auth/login[?returnTo=/path] — redirects to the Northlight consent page. */
    async login(request: Request): Promise<Response> {
      const url = new URL(request.url)
      const state = randomId()
      const { url: authorizeUrl, codeVerifier, nonce } = await oauth.authorizeUrl({ scopes, state })
      if (!nonce) throw new Error('scopes must include openid')
      const pending: PendingSignIn = { codeVerifier, nonce, returnTo: safePath(url.searchParams.get('returnTo')) }
      await kv.put(`pending:${state}`, JSON.stringify(pending), { expirationTtl: PENDING_TTL_SECONDS })
      return redirect(authorizeUrl)
    },

    /** GET /auth/callback — finishes sign-in, stores the connection and session, sets the cookie. */
    async callback(request: Request): Promise<Response> {
      const url = new URL(request.url)
      const refusal = authorizationRefusalOf(url)
      if (refusal?.code === 'app_in_testing') {
        return page(
          403,
          'This app is still in testing',
          '<p>Heart Rush sign-in is limited to approved testers while the app is verified by Northlight. Ask the owner to add the email or phone number on your Northlight account as a tester, then <a href="/auth/login">try again</a>.</p>',
        )
      }
      const state = url.searchParams.get('state') ?? ''
      if (url.searchParams.get('error')) {
        return page(400, 'Sign-in was not completed', `<p>Northlight returned “${escapeHtml(url.searchParams.get('error')!)}”. <a href="/auth/login">Start sign-in again</a>.</p>`)
      }
      const code = url.searchParams.get('code')
      const raw = state ? await kv.get(`pending:${state}`) : null
      if (!code || !raw) {
        return page(400, 'Sign-in expired', '<p>That sign-in link is no longer valid. <a href="/auth/login">Start sign-in again</a>.</p>')
      }
      await kv.delete(`pending:${state}`)
      const pending = JSON.parse(raw) as PendingSignIn
      const connection = await oauth.exchangeCode({
        code,
        codeVerifier: pending.codeVerifier,
        state,
        expectedState: state,
        nonce: pending.nonce,
      })
      let displayName = connection.userId
      if (connection.idToken) {
        const claims = await oauth.verifyIdToken(connection.idToken, { nonce: pending.nonce })
        displayName = profileFromClaims(claims).name ?? displayName
      }
      // The SDK's exchangeCode does not save; saving here is what makes oauth.client(userId) work.
      await new KvConnectionStore(kv).save(connection)
      const sid = randomId()
      const session: Session = { userId: connection.userId, displayName }
      await kv.put(`session:${sid}`, JSON.stringify(session), { expirationTtl: sessionTtlSeconds })
      return redirect(pending.returnTo, cookie(request, sid, sessionTtlSeconds))
    },

    /** POST /auth/logout — deletes the session and clears the cookie. The stored connection is kept. */
    async logout(request: Request): Promise<Response> {
      const sid = sessionIdOf(request)
      if (sid) await kv.delete(`session:${sid}`)
      return redirect(homePath, cookie(request, '', 0))
    },

    /** The signed-in person, or null. */
    async getSession(request: Request): Promise<Session | null> {
      const sid = sessionIdOf(request)
      if (!sid) return null
      const raw = await kv.get(`session:${sid}`)
      return raw ? (JSON.parse(raw) as Session) : null
    },

    /** The SDK client on this person's own runtime. Throws CrouterError `not_connected` if they must sign in again. */
    runtimeFor(userId: string): Promise<ConnectedCrouter> {
      return oauth.client(userId)
    },
  }
}

export type NorthlightAuth = ReturnType<typeof createNorthlightAuth>

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
