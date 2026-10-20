# @heartrush/northlight

Northlight sign-in for TanStack Start apps on Cloudflare Workers. App-agnostic: tools uses it today, play reuses it unchanged. One storage backend: the app's own D1 database.

## Contract

```ts
import { createNorthlightAuth } from '@heartrush/northlight'

const auth = createNorthlightAuth({
  clientId,        // CROUTER_CLIENT_ID  (w5p61c34rt3p)
  issuer,          // CROUTER_ISSUER     (https://account.northlight.ai)
  redirectUri,     // `${origin}/auth/callback`, must be one of the registered redirect URIs; its origin is the origin `returnTo` must match
  privateKeyJson,  // Worker secret CROUTER_APP_KEY_JSON (JSON text of the app key)
  db,              // this app's D1 binding (`env.DB`) with the package migrations applied
  // optional: scopes (default openid, profile, crtr:llm, crtr:act — a run cannot start without crtr:act on the grant), cookieName (hr_session),
  //           sessionTtlSeconds (30 days), homePath ('/'),
  //           cookieDomain (e.g. '.heartrush.party'; shared sign-in across sibling hosts — see below),
  //           fetch (transport for directory requests; default global fetch — tests pass the fake directory's)
})
```

Returned object:

| Member | Route | Behaviour |
|---|---|---|
| `login(request)` | `GET /auth/login[?returnTo=/path]` | Inserts an `auth_pending` row (PKCE verifier, nonce, return path) keyed by the OAuth `state`, sets the short-lived transaction cookie `hr_session_tx` (HttpOnly, Lax, `Path=/auth`, 10 min, Secure on https) holding `state`, and 303s to Northlight. `returnTo` is parsed against the app origin; anything not same-origin goes to `homePath`, and the normalized path/query/hash is stored. |
| `callback(request)` | `GET /auth/callback` | Requires the transaction cookie to equal `state` (else a 400 "not started in this browser" page), then deletes the pending row (single use, 10 min), exchanges the code, upserts the `user` row, saves the connection, creates a session, **deletes the session the browser presented before** (rotation), clears the transaction cookie and 303s to the stored path. `app_in_testing` renders a 403 page; every other failure (denied, expired, replayed code, bad ID token, database error) renders a 400 page with a retry link. |
| `logout(request)` | `POST /auth/logout` | Deletes this browser's session row, clears the cookie, 303 to `homePath`. The stored connection is kept (the person stays connected). |
| `getSession(request)` | — | `Promise<{userId, displayName} \| null>`. Joins `session` and `user`; expired rows do not match. |
| `touchSession(request)` | — | Sliding session. `Promise<string \| null>`. When the presented session is valid and has less than 15 days left, one conditional `UPDATE` sets `expires_at` to now + `sessionTtlSeconds` and the call returns the `Set-Cookie` value to append to the response; otherwise null (no cookie, unknown, expired — an expired session is never revived — or 15+ days left). `getSession` never writes. |
| `revokeAllSessions(userId)` | — | Deletes every session of that user (use after an account change or a suspected stolen cookie). |
| `disconnect(userId)` | — | Deletes the user's sessions and their Northlight connection. The next AI call needs a fresh sign-in. Does not delete the `user` row (app data references it). |
| `runMaintenance()` | — | For the daily cron: deletes expired sessions and `auth_pending` rows older than 10 min, then `oauth.refreshIdleConnections({olderThanMs: 30 days})`. Returns counts and any refresh failures. |
| `runtimeFor(userId)` | — | The SDK's `oauth.client(userId)`: a `ConnectedCrouter` on that person's runtime. Throws `CrouterError` `not_connected` (or an `AuthenticationError` for which `refusalOf(e)` is set) when they must sign in again. |
| `oauth` | — | The underlying `OAuth2Client` (e.g. `accountAppUrl`). Its `onRefusal` deletes the user's sessions when the person removed the app (`removed`); `paused`/`reconnect` refusals keep sessions and the next AI call returns `not_connected`. |

Session cookie: `hr_session`, `HttpOnly; SameSite=Lax; Path=/; Max-Age=30d`, plus `Secure` on https (omitted on `http://localhost` so dev works).

### Shared sign-in (`cookieDomain`)

With `cookieDomain: '.heartrush.party'` the session cookie (callback, logout, `touchSession`) is written and cleared with `Domain=.heartrush.party`, so tools and play receive the same `hr_session`. Both apps must bind the same D1 database so the `session` and `connection` tables are shared: there is one `connection` row per user, and the latest sign-in on either app replaces it. The transaction cookie `hr_session_tx` stays host-only on `/auth`. Callback and logout also send a host-only `hr_session=; Max-Age=0` so a browser that signed in before the domain was set does not send two `hr_session` cookies. Leave `cookieDomain` unset on `localhost`; the cookies are then exactly as before (host-only).

## Tests

`test/fake-directory.ts` is a stand-in Northlight directory served through the `fetch` option (discovery, a JWKS from a WebCrypto key, the token endpoint with signed ID tokens with or without `email`, refresh refusals via `refuseRefresh('grant_removed' | 'grant_suspended' | …)`), plus `openTestDb()` (local workerd D1 with the migration applied). Play's tests reuse both.

## Storage

`migrations/0001_northlight_auth.sql` creates `user`, `session`, `auth_pending` and `connection`. `D1ConnectionStore` (exported) implements the SDK's `ConnectionStore`:

- `lock(userId, fn)` is a fenced lease on the `connection` row: `UPDATE … SET lock_token = ?, lock_until = now+30s WHERE user_id = ? AND (lock_until IS NULL OR lock_until < now)`; zero rows changed means another isolate holds it, so it retries every 250 ms up to 20 times and then throws `CrouterError('lock_timeout')`. A 10 s timer renews the lease while `fn` runs.
- `save` made inside the lock is `… WHERE user_id = ? AND lock_token = ?`; zero rows changed throws `CrouterError('lock_lost')` rather than overwrite a newer refresh token. A fresh sign-in's `save` (outside any lock) upserts and clears the lease, so a refresh still running for the old token loses.
- `remove(userId, refreshToken)` deletes only when the stored refresh token matches. `listStale(before)` selects by `updated_at` (100 per call).

`pnpm --filter @heartrush/northlight test` runs the store against a local workerd D1 (compare-and-set, timeout, lock_lost, stale listing).

The apps own everything else in the database: play adds its tables as migrations numbered `0100+` in its own migrations directory; this package reserves `0001–0099`.

## Wiring it into a TanStack Start app (as apps/tools does)

1. Create the app's D1 database: `npx wrangler d1 create heartrush-<app>`. In `wrangler.jsonc` add
   `"d1_databases": [{ "binding": "DB", "database_name": "heartrush-<app>", "database_id": "<id>", "migrations_dir": "../../packages/northlight/migrations" }]` (an app with its own migrations copies this package's SQL into its migrations directory instead, since a binding has one directory), `"compatibility_flags": ["nodejs_compat", "enable_request_signal"]`, `"triggers": { "crons": ["0 4 * * *"] }`, and `"vars": { "CROUTER_CLIENT_ID": "w5p61c34rt3p", "CROUTER_ISSUER": "https://account.northlight.ai", "APP_HOST": "<app>.heartrush.party" }`. Apply with `wrangler d1 migrations apply heartrush-<app> --remote` (`--local` for dev). The secret `CROUTER_APP_KEY_JSON` is already set on play and tools (`wrangler secret put` for any new Worker). Run `pnpm cf-typegen` afterwards.
2. Add `"@heartrush/northlight": "workspace:*"` and `"@north-light/sdk": "0.3.504"` (exact pin) to the app's dependencies.
3. `src/server/auth.ts`: build the auth lazily per request origin from `import { env } from 'cloudflare:workers'` (see `apps/tools/src/server/auth.ts`; declare `CROUTER_APP_KEY_JSON: string` on `Cloudflare.Env` — secrets are not in the generated types). Cache per origin: the redirect URI is `${origin}/auth/callback`, so the same code serves prod and `localhost`. Copy `apps/tools/src/server.ts` too and set `"main": "src/server.ts"`: it is the Worker entry that adds the `scheduled` handler calling `auth.runMaintenance()` (the cron trigger).
4. Three server routes: `src/routes/auth/login.ts` and `callback.ts` (`GET`) and `logout.ts` (`POST`), each `createFileRoute('/auth/…')({ server: { handlers: { GET: ({ request }) => authFor(request).login(request) } } })`.
5. Session for UI: a `createServerFn` that calls `getRequest()` (from `@tanstack/react-start/server`) and `auth.getSession(request)`; load it in the root route's `loader` so the header can show Sign in / Sign out. Logout is a plain `<form method="post" action="/auth/logout">`.
6. Run AI: `const runtime = await auth.runtimeFor(session.userId)` then `runtime.runs.parse({prompt, output_schema: zodSchema, scopes: ['crtr:llm', 'crtr:act'], deadline: '15m'}, {signal})`. Check `outcome.kind === 'result'` before using `output_parsed`. `parse` never cancels the run when `signal` aborts and does not expose its id; a route that must stop work when the browser leaves (as `apps/tools/src/routes/api/monster.ts` does) uses `runs.start`, `runs.wait` and `runs.cancel(run_id)`, and needs `enable_request_signal` for `request.signal` to fire.

Registered redirect URIs (Northlight console/CLI): `https://play.heartrush.party/auth/callback`, `https://tools.heartrush.party/auth/callback`, `http://localhost:3912/auth/callback`, `http://localhost:3911/auth/callback`. A new origin must be added with `npx @north-light/sdk apps set-redirect-uris`.

The app is in Northlight testing mode: only the owner and added testers can sign in (`npx @north-light/sdk apps testers add --email <email>`). Everyone else lands on the `app_in_testing` page.

Local dev needs the secret as a `.dev.vars` file in the app dir (gitignored): `CROUTER_APP_KEY_JSON='<contents of packages/northlight/local/app-key.json on one line>'`. Local dev uses a local D1 simulator: run `pnpm --filter <app> run db:migrate:local` once (tools has the script) so the tables exist; it is not the production database.
