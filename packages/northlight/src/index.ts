import {
  OAuth2Client,
  authorizationRefusalOf,
  profileFromClaims,
  type ConnectedCrouter,
} from '@north-light/sdk'
import { D1ConnectionStore } from './d1-store'
import { nowIso, type D1 } from './d1'

export type { D1 } from './d1'
export { D1ConnectionStore } from './d1-store'

export interface NorthlightAuthOptions {
  clientId: string
  issuer: string
  /** Absolute callback URL; must be one of the app's registered redirect URIs. Its origin is the one `returnTo` must match. */
  redirectUri: string
  /** The app's private signing key: the JSON text of `local/app-key.json` (secret `CROUTER_APP_KEY_JSON`). */
  privateKeyJson: string
  /** This app's D1 database (binding `DB`), with `migrations/` from this package applied. */
  db: D1
  /** Canonical user profiles and sessions; defaults to `db`. Supply the same D1 on sibling sites to share sign-in while keeping OAuth connections and pending sign-ins local. */
  sessionDb?: D1
  /** Scopes requested at sign-in. Default `['openid', 'profile', 'crtr:llm', 'crtr:act']`. */
  scopes?: string[]
  /** Session cookie name. Default `hr_session`. */
  cookieName?: string
  /** Session lifetime in seconds. Default 30 days. */
  sessionTtlSeconds?: number
  /**
   * Share the session cookie across sibling hosts, e.g. `.heartrush.party`: the session cookie is written and cleared with `Domain=<cookieDomain>`.
   * The sign-in transaction cookie stays host-only. Unset (localhost) the cookies are host-only. Every app sharing the cookie must share the `session` table.
   */
  cookieDomain?: string
  /** The transport for directory requests (discovery, JWKS, token), passed to the SDK's `OAuth2Client`. Default: global `fetch`. Tests stand in for the Northlight directory with it. */
  fetch?: typeof fetch
  /** Where `/auth/login` returns to when no valid `returnTo` is given, and where `/auth/logout` goes. Default `/`. */
  homePath?: string
}

export interface Session {
  userId: string
  displayName: string
}

export interface MaintenanceResult {
  sessionsDeleted: number
  pendingDeleted: number
  refreshed: number
  refused: number
  failures: { userId: string; error: unknown }[]
}

const PENDING_TTL_SECONDS = 600
const RENEW_BELOW_SECONDS = 15 * 24 * 60 * 60
const IDLE_CONNECTION_MS = 30 * 24 * 60 * 60 * 1000

export function createNorthlightAuth(options: NorthlightAuthOptions) {
  const {
    db,
    sessionDb = db,
    scopes = ['openid', 'profile', 'crtr:llm', 'crtr:act'],
    cookieName = 'hr_session',
    sessionTtlSeconds = 60 * 60 * 24 * 30,
    homePath = '/',
    cookieDomain,
  } = options
  const txCookieName = `${cookieName}_tx`
  const origin = new URL(options.redirectUri).origin
  const secure = origin.startsWith('https:')

  const store = new D1ConnectionStore(db)
  const ownsSessionDb = sessionDb === db
  const oauth = new OAuth2Client({
    clientId: options.clientId,
    issuer: options.issuer,
    redirectUri: options.redirectUri,
    privateKey: JSON.parse(options.privateKeyJson),
    store,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    // The person removed the app or their account: their sessions here are dead. Other refusals keep sessions.
    onRefusal: async (refusal) => {
      if (refusal.kind === 'removed') await revokeAllSessions(refusal.userId)
    },
  })

  const randomId = (bytes: number) =>
    btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

  /** The normalized same-origin path (with query and hash) for `value`, or `homePath` when it is absent or points elsewhere. */
  const safePath = (value: string | null) => {
    if (!value) return homePath
    try {
      const target = new URL(value, origin)
      return target.origin === origin ? target.pathname + target.search + target.hash : homePath
    } catch {
      return homePath
    }
  }

  const cookie = (name: string, value: string, maxAge: number, path: string, domain?: string) =>
    [
      `${name}=${value}`,
      `Path=${path}`,
      ...(domain ? [`Domain=${domain}`] : []),
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAge}`,
      ...(secure ? ['Secure'] : []),
    ].join('; ')

  /** The session cookie as this app writes it: on `cookieDomain` when set, else host-only. */
  const sessionCookie = (value: string, maxAge: number) => cookie(cookieName, value, maxAge, '/', cookieDomain)
  /**
   * With a shared `cookieDomain`, a browser that signed in before it was set holds a host-only `hr_session` too; the browser would send both.
   * Clearing the host-only one (a `Set-Cookie` with no `Domain`) leaves only the shared cookie.
   */
  const clearHostOnlySession = cookieDomain ? [cookie(cookieName, '', 0, '/')] : []

  const redirect = (location: string, ...setCookies: string[]) => {
    const headers = new Headers({ location })
    for (const c of setCookies) headers.append('set-cookie', c)
    return new Response(null, { status: 303, headers })
  }

  const page = (status: number, title: string, body: string, ...setCookies: string[]) => {
    const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' })
    for (const c of setCookies) headers.append('set-cookie', c)
    return new Response(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
        `<body style="font-family:system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1rem;line-height:1.5"><h1>${title}</h1>${body}</body></html>`,
      { status, headers },
    )
  }

  const cookieOf = (request: Request, name: string) => {
    for (const part of (request.headers.get('cookie') ?? '').split(';')) {
      const [key, ...rest] = part.trim().split('=')
      if (key === name) return rest.join('=') || null
    }
    return null
  }

  const clearTx = cookie(txCookieName, '', 0, '/auth')
  const retry = '<a href="/auth/login">Start sign-in again</a>'

  async function revokeAllSessions(userId: string): Promise<void> {
    await sessionDb.prepare('DELETE FROM session WHERE user_id = ?').bind(userId).run()
  }

  return {
    /** The underlying SDK client, for anything not covered here (accountAppUrl…). */
    oauth,

    /** GET /auth/login[?returnTo=/path] — redirects to the Northlight consent page. */
    async login(request: Request): Promise<Response> {
      const url = new URL(request.url)
      const state = randomId(24)
      const { url: authorizeUrl, codeVerifier, nonce } = await oauth.authorizeUrl({ scopes, state })
      if (!nonce) throw new Error('scopes must include openid')
      await db
        .prepare('INSERT INTO auth_pending (state, code_verifier, nonce, next_path, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(state, codeVerifier, nonce, safePath(url.searchParams.get('returnTo')), nowIso())
        .run()
      // The cookie ties this sign-in to this browser: the callback only proceeds in the browser that holds it.
      return redirect(authorizeUrl, cookie(txCookieName, state, PENDING_TTL_SECONDS, '/auth'))
    },

    /** GET /auth/callback — finishes sign-in, stores the connection and session, rotates the browser's session. */
    async callback(request: Request): Promise<Response> {
      const url = new URL(request.url)
      const state = url.searchParams.get('state') ?? ''
      if (!state || cookieOf(request, txCookieName) !== state) {
        return page(
          400,
          'Sign-in expired',
          `<p>This sign-in was not started in this browser, or it expired. ${retry}.</p>`,
          clearTx,
        )
      }
      // Consume the pending entry: it can be used once, by the browser that started it.
      const cutoff = new Date(Date.now() - PENDING_TTL_SECONDS * 1000).toISOString()
      const pending = await db
        .prepare('DELETE FROM auth_pending WHERE state = ? AND created_at >= ? RETURNING code_verifier, nonce, next_path')
        .bind(state, cutoff)
        .first<{ code_verifier: string; nonce: string; next_path: string }>()
      if (!pending) {
        return page(400, 'Sign-in expired', `<p>That sign-in link is no longer valid. ${retry}.</p>`, clearTx)
      }
      const refusal = authorizationRefusalOf(url)
      if (refusal?.code === 'app_in_testing') {
        return page(
          403,
          'This app is still in testing',
          '<p>Heart Rush sign-in is limited to approved testers while the app is verified by Northlight. Ask the owner to add the email or phone number on your Northlight account as a tester, then <a href="/auth/login">try again</a>.</p>',
          clearTx,
        )
      }
      const error = url.searchParams.get('error')
      if (error) {
        return page(400, 'Sign-in was not completed', `<p>Northlight returned “${escapeHtml(error)}”. ${retry}.</p>`, clearTx)
      }
      const code = url.searchParams.get('code')
      if (!code) return page(400, 'Sign-in expired', `<p>That sign-in link is no longer valid. ${retry}.</p>`, clearTx)

      try {
        const connection = await oauth.exchangeCode({
          code,
          codeVerifier: pending.code_verifier,
          state,
          expectedState: state,
          nonce: pending.nonce,
        })
        let displayName = connection.userId
        let email: string | null = null
        if (connection.idToken) {
          const claims = await oauth.verifyIdToken(connection.idToken, { nonce: pending.nonce })
          displayName = profileFromClaims(claims).name ?? displayName
          email = claims.email ?? null
        }
        await upsertUser(sessionDb, connection.userId, displayName, email)
        if (!ownsSessionDb) await upsertUser(db, connection.userId, displayName, email)
        // The SDK's exchangeCode does not save; saving here is what makes oauth.client(userId) work.
        await store.save(connection)
        const sid = randomId(16)
        await sessionDb
          .prepare('INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)')
          .bind(sid, connection.userId, new Date(Date.now() + sessionTtlSeconds * 1000).toISOString())
          .run()
        // Rotate: whatever session this browser held before is retired by the new sign-in.
        const previous = cookieOf(request, cookieName)
        if (previous) await sessionDb.prepare('DELETE FROM session WHERE id = ?').bind(previous).run()
        return redirect(pending.next_path, sessionCookie(sid, sessionTtlSeconds), ...clearHostOnlySession, clearTx)
      } catch (e) {
        console.error('northlight sign-in failed', e)
        return page(400, 'Sign-in failed', `<p>Northlight could not complete this sign-in. ${retry}.</p>`, clearTx)
      }
    },

    /** POST /auth/logout — deletes this browser's session and clears the cookie. The stored connection is kept. */
    async logout(request: Request): Promise<Response> {
      const sid = cookieOf(request, cookieName)
      if (sid) await sessionDb.prepare('DELETE FROM session WHERE id = ?').bind(sid).run()
      return redirect(homePath, sessionCookie('', 0), ...clearHostOnlySession)
    },

    /** The signed-in person, or null. */
    async getSession(request: Request): Promise<Session | null> {
      const sid = cookieOf(request, cookieName)
      if (!sid) return null
      const row = await sessionDb
        .prepare(
          `SELECT s.user_id, u.display_name, u.email FROM session s JOIN user u ON u.id = s.user_id
           WHERE s.id = ? AND s.expires_at > ?`,
        )
        .bind(sid, nowIso())
        .first<{ user_id: string; display_name: string; email: string | null }>()
      if (!row) return null
      // The shared profile is authoritative; materialize it before handing an app a user id it may reference with a local FK.
      if (!ownsSessionDb) await upsertUser(db, row.user_id, row.display_name, row.email)
      return { userId: row.user_id, displayName: row.display_name }
    },

    /**
     * Slide a valid session when it has less than 15 days left. Return each Set-Cookie as a separate header value.
     * A domain cookie must be reissued even without renewal to replace a pre-cutover host-only cookie, preserving its remaining lifetime.
     * `getSession` never writes.
     */
    async touchSession(request: Request): Promise<string[] | null> {
      const sid = cookieOf(request, cookieName)
      if (!sid) return null
      const now = Date.now()
      const row = await sessionDb.prepare('SELECT expires_at FROM session WHERE id = ? AND expires_at > ?')
        .bind(sid, new Date(now).toISOString()).first<{ expires_at: string }>()
      if (!row) return null
      let remainingSeconds = Math.max(1, Math.ceil((Date.parse(row.expires_at) - now) / 1000))
      let renewed = false
      if (remainingSeconds < RENEW_BELOW_SECONDS) {
        const result = await sessionDb
          .prepare('UPDATE session SET expires_at = ? WHERE id = ? AND expires_at > ? AND expires_at < ?')
          .bind(
            new Date(now + sessionTtlSeconds * 1000).toISOString(),
            sid,
            new Date(now).toISOString(),
            new Date(now + RENEW_BELOW_SECONDS * 1000).toISOString(),
          )
          .run()
        if (result.meta.changes > 0) {
          remainingSeconds = sessionTtlSeconds
          renewed = true
        }
        else {
          // A concurrent logout or expiry cannot result in a fresh cookie; a concurrent renewal uses its own remaining lifetime.
          const current = await sessionDb.prepare('SELECT expires_at FROM session WHERE id = ? AND expires_at > ?')
            .bind(sid, nowIso()).first<{ expires_at: string }>()
          if (!current) return null
          remainingSeconds = Math.max(1, Math.ceil((Date.parse(current.expires_at) - Date.now()) / 1000))
        }
      }
      if (cookieDomain) return [sessionCookie(sid, remainingSeconds), ...clearHostOnlySession]
      return renewed ? [sessionCookie(sid, sessionTtlSeconds)] : null
    },

    /** Sign `userId` out everywhere: deletes every session of theirs. The connection is kept. */
    revokeAllSessions,

    /** Forget `userId`'s Northlight connection and sign them out everywhere. The next AI call needs a fresh sign-in. */
    async disconnect(userId: string): Promise<void> {
      await revokeAllSessions(userId)
      await db.prepare('DELETE FROM connection WHERE user_id = ?').bind(userId).run()
    },

    /**
     * Daily maintenance (run it from a cron trigger): delete expired sessions and abandoned sign-ins, then refresh
     * connections idle for 30 days so their refresh tokens stay alive (refusals are cleaned up by `onRefusal`).
     */
    async runMaintenance(): Promise<MaintenanceResult> {
      const now = Date.now()
      const sessions = ownsSessionDb
        ? await sessionDb.prepare('DELETE FROM session WHERE expires_at <= ?').bind(new Date(now).toISOString()).run()
        : { meta: { changes: 0 } }
      const pending = await db
        .prepare('DELETE FROM auth_pending WHERE created_at < ?')
        .bind(new Date(now - PENDING_TTL_SECONDS * 1000).toISOString())
        .run()
      const idle = await oauth.refreshIdleConnections({ olderThanMs: IDLE_CONNECTION_MS })
      return { sessionsDeleted: sessions.meta.changes, pendingDeleted: pending.meta.changes, ...idle }
    },

    /** The SDK client on this person's own runtime. Throws CrouterError `not_connected` if they must sign in again. */
    runtimeFor(userId: string): Promise<ConnectedCrouter> {
      return oauth.client(userId)
    },
  }
}

export type NorthlightAuth = ReturnType<typeof createNorthlightAuth>

async function upsertUser(db: D1, userId: string, displayName: string, email: string | null): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user (id, display_name, email) VALUES (?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET display_name = excluded.display_name, email = COALESCE(excluded.email, user.email)`,
    )
    .bind(userId, displayName, email)
    .run()
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
