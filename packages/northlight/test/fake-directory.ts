import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import assert from 'node:assert/strict'
import { createNorthlightAuth, type NorthlightAuthOptions } from '../src/index'
import type { D1 } from '../src/d1'

/** A local in-memory D1 (the same workerd D1 as production) with the package migration applied. */
export async function openTestDb() {
  const dir = mkdtempSync(join(tmpdir(), 'northlight-test-'))
  const configPath = join(dir, 'wrangler.jsonc')
  writeFileSync(
    configPath,
    JSON.stringify({
      name: 'northlight-test',
      compatibility_date: '2026-05-01',
      d1_databases: [{ binding: 'DB', database_name: 'test', database_id: '00000000-0000-0000-0000-000000000000' }],
    }),
  )
  const proxy = await getPlatformProxy<{ DB: D1 }>({ configPath, persist: false })
  const sql = readFileSync(new URL('../migrations/0001_northlight_auth.sql', import.meta.url), 'utf8')
  for (const s of sql.replace(/--.*$/gm, '').split(';').map((x) => x.trim()).filter(Boolean)) {
    await proxy.env.DB.prepare(s).run()
  }
  return { db: proxy.env.DB, dispose: () => proxy.dispose() }
}

const b64url = (bytes: Uint8Array | string) =>
  Buffer.from(typeof bytes === 'string' ? bytes : bytes).toString('base64url')

export const ISSUER = 'https://directory.test'
export const CLIENT_ID = 'test-client'

/** A stand-in for the Northlight directory, served through the `fetch` option: discovery, JWKS, token endpoint. */
export async function createFakeDirectory() {
  const signing = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publicJwk = { ...(await crypto.subtle.exportKey('jwk', signing.publicKey)), kid: 'fake-key', alg: 'ES256', use: 'sig' }
  // The app's own private key (what `privateKeyJson` holds); the fake does not verify client assertions.
  const appKey = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const privateKeyJson = JSON.stringify({ ...(await crypto.subtle.exportKey('jwk', appKey.privateKey)), kid: 'app-key', alg: 'ES256' })

  const sign = async (header: object, payload: object) => {
    const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signing.privateKey, new TextEncoder().encode(input))
    return `${input}.${b64url(new Uint8Array(sig))}`
  }

  interface Code { userId: string; name: string; email?: string; nonce: string }
  const codes = new Map<string, Code>()
  const refreshTokens = new Map<string, string>() // refresh token -> user id
  let refusal: string | null = null
  let counter = 0
  const calls: { path: string; grantType?: string }[] = []

  const connectionFor = async (userId: string) => {
    const refreshToken = `refresh-${++counter}`
    refreshTokens.set(refreshToken, userId)
    const exp = Math.floor(Date.now() / 1000) + 3600
    const accessToken = await sign({ alg: 'ES256', kid: 'fake-key' }, { sub: userId, grant: 'grant-1', exp })
    return { access_token: accessToken, refresh_token: refreshToken, runtimeUrl: 'https://runtime.test' }
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (url.pathname === '/.well-known/openid-configuration') {
      calls.push({ path: 'discovery' })
      return json(200, {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        jwks_uri: `${ISSUER}/jwks`,
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
      })
    }
    if (url.pathname === '/jwks') {
      calls.push({ path: 'jwks' })
      return json(200, { keys: [publicJwk] })
    }
    if (url.pathname === '/token') {
      const form = new URLSearchParams(String(init?.body))
      const grantType = form.get('grant_type') ?? ''
      calls.push({ path: 'token', grantType })
      if (grantType === 'authorization_code') {
        const entry = codes.get(form.get('code') ?? '')
        if (!entry) return json(400, { error: 'invalid_grant', error_description: 'bad code' })
        codes.delete(form.get('code') ?? '')
        const now = Math.floor(Date.now() / 1000)
        const idToken = await sign(
          { alg: 'ES256', kid: 'fake-key' },
          {
            iss: ISSUER,
            aud: CLIENT_ID,
            sub: entry.userId,
            nonce: entry.nonce,
            iat: now,
            exp: now + 600,
            name: entry.name,
            ...(entry.email ? { email: entry.email } : {}),
          },
        )
        return json(200, { ...(await connectionFor(entry.userId)), id_token: idToken })
      }
      if (grantType === 'refresh_token') {
        if (refusal) return json(400, { error: 'invalid_grant', error_description: refusal })
        const userId = refreshTokens.get(form.get('refresh_token') ?? '')
        if (!userId) return json(400, { error: 'invalid_grant', error_description: 'refresh_token_reused' })
        return json(200, await connectionFor(userId))
      }
    }
    return json(404, { error: 'not_found' })
  }) as typeof fetch

  return {
    fetch: fetcher,
    privateKeyJson,
    clientId: CLIENT_ID,
    issuer: ISSUER,
    calls,
    /** Register the authorization code the browser will bring back to the callback. */
    expectCode(code: string, entry: Code) {
      codes.set(code, entry)
    },
    /** Every later refresh is refused with this directory code (`grant_removed`, `grant_suspended`…); null stops refusing. */
    refuseRefresh(code: string | null) {
      refusal = code
    },
  }
}

export type FakeDirectory = Awaited<ReturnType<typeof createFakeDirectory>>

// ---- helpers for driving the auth object like a browser ----

export const REDIRECT = 'https://play.heartrush.party/auth/callback'

export const makeAuth = (db: D1, dir: FakeDirectory, extra: Partial<NorthlightAuthOptions> = {}) =>
  createNorthlightAuth({
    clientId: dir.clientId,
    issuer: dir.issuer,
    redirectUri: REDIRECT,
    privateKeyJson: dir.privateKeyJson,
    db,
    fetch: dir.fetch,
    ...extra,
  })

/** Set-Cookie header values of a response. */
export const setCookies = (res: Response) => res.headers.getSetCookie()

export const cookieHeader = (...pairs: string[]) => ({ cookie: pairs.join('; ') })

/** Runs login then callback in one "browser" for `userId`; returns the callback response. */
export async function signIn(
  auth: ReturnType<typeof makeAuth>,
  dir: FakeDirectory,
  user: { userId: string; name: string; email?: string },
  browserCookies: string[] = [],
) {
  const login = await auth.login(new Request('https://play.heartrush.party/auth/login'))
  assert.equal(login.status, 303)
  const authorize = new URL(login.headers.get('location')!)
  const state = authorize.searchParams.get('state')!
  const nonce = authorize.searchParams.get('nonce')!
  const code = `code-${state}`
  dir.expectCode(code, { ...user, nonce })
  const tx = `hr_session_tx=${state}`
  return auth.callback(
    new Request(`${REDIRECT}?code=${code}&state=${state}`, { headers: cookieHeader(tx, ...browserCookies) }),
  )
}

export const sessionIdOf = (res: Response) => {
  const c = setCookies(res).find((x) => x.startsWith('hr_session='))
  assert.ok(c, 'session cookie set')
  return c.split(';')[0].slice('hr_session='.length)
}
