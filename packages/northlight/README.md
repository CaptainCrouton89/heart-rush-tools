# @heartrush/northlight

Northlight sign-in for TanStack Start apps on Cloudflare Workers. App-agnostic: tools uses it today, play reuses it unchanged.

## Contract

```ts
import { createNorthlightAuth } from '@heartrush/northlight'

const auth = createNorthlightAuth({
  clientId,        // CROUTER_CLIENT_ID  (w5p61c34rt3p)
  issuer,          // CROUTER_ISSUER     (https://account.northlight.ai)
  redirectUri,     // `${origin}/auth/callback`, must be one of the registered redirect URIs
  privateKeyJson,  // Worker secret CROUTER_APP_KEY_JSON (JSON text of the app key)
  kv,              // this app's own KV namespace binding
  // optional: scopes (default openid, profile, crtr:llm, crtr:act — a run cannot start without crtr:act on the grant), cookieName (hr_session),
  //           sessionTtlSeconds (30 days), homePath ('/')
})
```

Returned object (all take a standard `Request`, all return a `Response` except where noted):

| Member | Route | Behaviour |
|---|---|---|
| `login(request)` | `GET /auth/login[?returnTo=/path]` | Stores PKCE verifier + nonce in KV under the OAuth `state` (10 min), 303 to Northlight. `returnTo` must be a same-site path. |
| `callback(request)` | `GET /auth/callback` | Exchanges the code, saves the Northlight connection, creates a session, sets the cookie, 303 to `returnTo`. `app_in_testing` renders a 403 page explaining the app is in testing; other errors render a 400 page with a retry link. |
| `logout(request)` | `POST /auth/logout` | Deletes the session, clears the cookie, 303 to `homePath`. The stored connection is kept (the person stays connected). |
| `getSession(request)` | — | `Promise<{userId, displayName} \| null>`. Reads the cookie, looks the session up in KV. |
| `runtimeFor(userId)` | — | The SDK's `oauth.client(userId)`: a `ConnectedCrouter` on that person's runtime. Throws `CrouterError` `not_connected` (or an `AuthenticationError` for which `refusalOf(e)` is set) when they must sign in again. |
| `oauth` | — | The underlying `OAuth2Client` (e.g. `refreshIdleConnections`, `accountAppUrl`). |

Session cookie: `hr_session`, `HttpOnly; SameSite=Lax; Path=/; Max-Age=30d`, plus `Secure` on https (omitted on `http://localhost` so dev works).

KV key prefixes (all in the one namespace you pass): `conn:<userId>` (SDK connection), `session:<sid>`, `pending:<state>`, `lock:<userId>` (refresh lease).

`KvConnectionStore` is exported too. KV has no compare-and-set, so its `lock` is an in-isolate queue plus a KV lease key: it prevents nearly all concurrent refreshes of one person's refresh token but is not a hard cross-isolate guarantee. If that ever bites (`refresh_token_reused`), move connections to D1 or a Durable Object.

## Wiring it into a TanStack Start app (as apps/tools does)

1. Create a KV namespace for the app: `npx wrangler kv namespace create heartrush-<app>-auth`; add to `wrangler.jsonc`:
   `"kv_namespaces": [{ "binding": "AUTH_KV", "id": "<id>" }]`, and `"vars": { "CROUTER_CLIENT_ID": "w5p61c34rt3p", "CROUTER_ISSUER": "https://account.northlight.ai" }`. The secret `CROUTER_APP_KEY_JSON` is already set on play and tools (`wrangler secret put` for any new Worker). Run `pnpm cf-typegen` afterwards.
2. Add `"@heartrush/northlight": "workspace:*"` and `"@north-light/sdk": "0.3.504"` (exact pin) to the app's dependencies.
3. `src/server/auth.ts`: build the auth lazily per request origin from `import { env } from 'cloudflare:workers'` (see `apps/tools/src/server/auth.ts`; declare `CROUTER_APP_KEY_JSON: string` on `Cloudflare.Env` — secrets are not in the generated types). Cache per origin: the redirect URI is `${origin}/auth/callback`, so the same code serves prod and `localhost`.
4. Three server routes: `src/routes/auth/login.ts` and `callback.ts` (`GET`) and `logout.ts` (`POST`), each `createFileRoute('/auth/…')({ server: { handlers: { GET: ({ request }) => authFor(request).login(request) } } })`.
5. Session for UI: a `createServerFn` that calls `getRequest()` (from `@tanstack/react-start/server`) and `auth.getSession(request)`; load it in the root route's `loader` so the header can show Sign in / Sign out. Logout is a plain `<form method="post" action="/auth/logout">`.
6. Run AI: `const runtime = await auth.runtimeFor(session.userId)` then `runtime.runs.parse({prompt, output_schema: zodSchema, scopes: ['crtr:llm', 'crtr:act'], deadline: '15m'})`. Check `outcome.kind === 'result'` before using `output_parsed`.

Registered redirect URIs (Northlight console/CLI): `https://play.heartrush.party/auth/callback`, `https://tools.heartrush.party/auth/callback`, `http://localhost:3912/auth/callback`, `http://localhost:3911/auth/callback`. A new origin must be added with `npx @north-light/sdk apps set-redirect-uris`.

The app is in Northlight testing mode: only the owner and added testers can sign in (`npx @north-light/sdk apps testers add --email <email>`). Everyone else lands on the `app_in_testing` page.

Local dev needs the secret as a `.dev.vars` file in the app dir (gitignored): `CROUTER_APP_KEY_JSON='<contents of packages/northlight/local/app-key.json on one line>'`. Local `wrangler dev`/vite KV is a local simulator, not the production namespace.
