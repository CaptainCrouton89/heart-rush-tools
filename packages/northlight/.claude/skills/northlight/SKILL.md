---
name: northlight
description: "Use when building, debugging or shipping an app that signs people in with Northlight, starts runs on their Northlight runtime, or calls Northlight providers (sms, search, integrations, context, device) with @north-light/sdk."
metadata:
  sdk-version: "0.3.504"
---

# Building a Northlight app

An app on Northlight signs people in with their Northlight account, then starts agent runs and calls providers (sms, search, integrations, context, device) on that person's own Northlight-hosted runtime, using their AI subscription. You write and host the app server with `@north-light/sdk`. Northlight hosts the directory (accounts, app registration, consent, the marketplace) and each person's runtime. It does not host your app's code. See [Where your app runs](https://sdk.docs.northlight.ai/docs/how-it-fits.md).

## First: check this skill matches the SDK

This skill is for SDK version `0.3.504`. If the project has `node_modules/@north-light/sdk/package.json`, compare its `version` with that number. If they differ, run `npx @north-light/sdk skill` in the project, then read the rewritten `.agents/skills/northlight/SKILL.md` (or `.claude/skills/northlight/SKILL.md`) instead of this copy. That command needs no account and no crtr. A project that has no SDK yet starts with `npx @north-light/sdk@latest init <dir>`.

## Where things run

- **Your server** runs wherever you choose (your laptop while developing). It holds the app's private signing key and each person's stored connection.
- **account.northlight.ai** is the directory. People sign up and consent there. You register the app with `npx @north-light/sdk register`, or in its web console, `https://account.northlight.ai/console`.
- **The person's runtime** runs their agents. Your server reaches it with `oauth.client(userId)` and calls `runs.*` and `providers.*` on it.

An app signs requests with a key pair, not a client secret. The private key stays in `local/app-key.json`; the directory holds only the public key.

## The journey

You run the commands. The person does two things in a browser: signs up, and chooses Allow (on a login page, then on the app's consent page). Everything else is yours.

1. **Account (person).** They sign up at `https://account.northlight.ai/signup`. Signup texts a code over iMessage, so the phone must have iMessage.
2. **Scaffold (you).** In a new folder run `npx @north-light/sdk@latest init my-app`. In an existing Node project run `npx @north-light/sdk init` instead: it adds the SDK pinned to an exact version, a key and this skill, and overwrites nothing. A new app gets `local/app.env` with the issuer, the origin `http://localhost:3000` and an empty `CROUTER_CLIENT_ID=`.
3. **Log in (you run it, the person approves).** Run `npx @north-light/sdk login`. It prints a link and a code. Show the person the link and the code exactly as printed and ask them to open the link, check the page shows the same code, and choose **Allow**. Read everything `login` printed and its exit code before you tell the person what happened. If your command times out or is killed first, run `login` again: it resumes the same code (do not pass `--new`). Each message means one thing:
   - `Still waiting for the login started at HH:MM.` is the same code: ask the person to approve it.
   - `Already logged in as …` (exit 0) means the login exists: go to step 4. Do not log in again.
   - `The code expired before it was approved` (exit 1) means nobody approved it in 10 minutes: run `login` again for a new code and tell the person to approve that one promptly. It is not a network problem.
   - `The login was declined in the browser` (exit 1): the person chose Deny. Ask before trying again.
   - `Couldn't reach … The code … is still saved` (exit 1) is a network problem that may pass: run `login` again to resume. Only if it keeps failing, use step 7.
   `npx @north-light/sdk whoami` checks the login. Never describe a failure as a network timeout unless the output says it couldn't reach the directory.
4. **Register (you).** For the quickstart app run `npx @north-light/sdk register --scope sms:send`. `sms:send` is the scope `server.ts` requests. It registers the app with the public key from `local/app-key.json`, adds the scope and writes `CROUTER_CLIENT_ID` to `local/app.env`. For any other provider scope: register first, find the string with `npx @north-light/sdk apps asks` (it needs the registered app), then add it with `npx @north-light/sdk apps set-scopes --add <scope>`. Never invent a scope string ([Scopes and grants](https://sdk.docs.northlight.ai/docs/concepts/scopes-and-grants.md)). To give the app a logo image or brand colour, use `apps set-logo --file <path>` and `apps set-brand-color --color <#rrggbb>`.
5. **Run it (you, then the person).** `npm i`, then `npm start`. Run `npm i` before `register` or any other command if the project pins an SDK version: without installed dependencies `npx` downloads the newest published release of the SDK, not the pinned one. Ask the person to open `http://localhost:3000/auth/login`, sign in and choose **Allow**. The page then starts a run and sends them a text.
6. **Testing mode.** A new app is in testing: only its owner and up to 100 testers can sign in. Add one with `npx @north-light/sdk apps testers add --email <email>`. Anyone else's callback gets `error=access_denied` with `error_description=app_in_testing` ([Testing mode](https://sdk.docs.northlight.ai/docs/concepts/testing-mode.md)). Going public needs verification: email support@northlight.ai.
7. **If login is not possible** (no network to `account.northlight.ai`, or the person prefers the browser): they register at `https://account.northlight.ai/console/new`. Ask them to fill in **Name**, **Origin URL** (`http://localhost:3000`), **Logo URL** (a square image), **Why your app needs access** (one sentence) and **Redirect URIs** (`http://localhost:3000/auth/callback`, matched exactly), and to paste the public JWK that `init` printed. Never ask for or accept the private key. On the app's **What it asks for** tab they choose **Add permissions**, add `sms:send` and choose **Save** (**Done** alone stores nothing). Ask for the client ID the console shows, then run `npx @north-light/sdk env --client-id <client id>`.

Check each step worked before the next: a `local/app-key.json` file exists, `whoami` names the person, a client ID is in `local/app.env`, the server prints `Listening on http://localhost:3000`, `/auth/login` reaches the Northlight consent page, and the callback lands back on your server. If a step fails, read the error and the page it names before changing code.

## Code patterns

These come from the `server.ts` that `init` writes. The SDK reads no environment: your code passes the values in.

### Configure `OAuth2Client`

```ts
const store = new MemoryConnectionStore(); // one process only; use a persistent ConnectionStore in production
const oauth = new OAuth2Client({
  clientId: process.env.CROUTER_CLIENT_ID ?? '',
  issuer: process.env.CROUTER_ISSUER ?? 'https://account.northlight.ai',
  redirectUri: `${origin}/auth/callback`,
  privateKey: JSON.parse(await readFile(process.env.CROUTER_KEY_FILE ?? 'local/app-key.json', 'utf8')),
  store,
});
```

### Sign in: `/auth/login` and `/auth/callback`

```ts
if (url.pathname === '/auth/login') {
  const {url: authorizeUrl, codeVerifier, state, nonce} = await oauth.authorizeUrl({
    scopes: ['openid', 'profile', 'crtr:llm', 'crtr:act', 'sms:send'],
    state: randomBytes(16).toString('base64url'),
  });
  pending.set(state, {codeVerifier, nonce});
  return void res.writeHead(303, {location: authorizeUrl}).end();
}

if (url.pathname === '/auth/callback') {
  if (authorizationRefusalOf(url)?.code === 'app_in_testing') {
    return page(res, 403, '<h1>This app is still in testing</h1><p>Ask its owner to add you on the Testers tab in the console.</p>');
  }
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  const saved = pending.get(state);
  if (!saved || !code) return page(res, 400, '<p>Start sign-in again at <a href="/auth/login">/auth/login</a>.</p>');
  pending.delete(state);
  const connection = await oauth.exchangeCode({code, codeVerifier: saved.codeVerifier, state, expectedState: state, nonce: saved.nonce});
  await store.save(connection);
  const sid = randomBytes(16).toString('base64url');
  sessions.set(sid, connection.userId);
  return void res.writeHead(303, {location: '/', 'set-cookie': `sid=${sid}; HttpOnly; SameSite=Lax; Path=/`}).end();
}
```

Keep `codeVerifier` and `nonce` per sign-in, keyed by `state`, and pass the same `state` as `expectedState` when exchanging the code. The example keeps them in a `Map` and sessions in memory; use real sessions in production ([Connections](https://sdk.docs.northlight.ai/docs/concepts/connections.md), [Go live](https://sdk.docs.northlight.ai/docs/guides/go-live.md)).

### Start a run and call a provider

```ts
const runtime = await oauth.client(userId); // a client on this person's runtime, from their stored connection
// The prompt is the instruction; the message stored with it joins the first turn, so `reply` can follow that turn.
const started = await runtime.runs.start({prompt: 'Reply with exactly the word: pong', message: 'ping', scopes: ['crtr:llm', 'crtr:act']});
const reply = await runtime.runs.reply(started.run_id, started.message!).collect(); // reply.text is what the agent said
const run = await runtime.runs.wait(started.run_id); // status is 'idle' once the reply is done

// Texts the signed-in person's own verified phone through the sms provider (50 per person per UTC day).
const sent = await runtime.providers.call({provider: 'sms', tool: 'send', arguments: {body: 'Hello from my first Northlight app.'}});
```

### Get a typed result back with `runs.parse`

```ts
import {z} from 'zod';
import type {ConnectedCrouter} from '@north-light/sdk';

const Profile = z.object({
  display_name: z.string(),
  bio: z.string(),
  facts: z.array(z.string()),
});

/** Start a run on the person's runtime and get a value back that was checked against the schema. */
export async function draftProfile(runtime: ConnectedCrouter) {
  const outcome = await runtime.runs.parse({
    prompt: 'Draft a public profile for me from my notes.',
    scopes: ['crtr:llm'], // submitting a result needs no other scope
    output_schema: Profile,
  });

  if (outcome.kind === 'result') return outcome.output_parsed; // {display_name, bio, facts}, typed from Profile
  if (outcome.reason === 'declined') {
    // The agent could not honestly satisfy the schema; outcome.details says why.
    throw new Error(`Declined: ${outcome.details?.reason ?? 'no reason given'}`);
  }
  throw new Error(`The run ended without a result: ${outcome.reason}`); // canceled, deadline_exceeded or runtime_error
}
```

### List a provider's tools, then call one

```ts
import type {ConnectedCrouter} from '@north-light/sdk';

/** List the tools a provider offers this person, then call one. Scope strings come from the console's
 *  "Add permissions" list; tool names and arguments come from `providers.tools`. Never invent either. */
export async function textMe(runtime: ConnectedCrouter, body: string) {
  const sms = await runtime.providers.tools('sms');
  console.log(JSON.stringify(sms.groups, null, 2)); // each leaf: tool, description, params

  return runtime.providers.call({provider: 'sms', tool: 'send', arguments: {body}});
}
```

## Rules

Details behind each rule: [Errors](https://sdk.docs.northlight.ai/docs/errors.md), [Typed results](https://sdk.docs.northlight.ai/docs/guides/typed-results.md), [Connections](https://sdk.docs.northlight.ai/docs/concepts/connections.md).

- **Pin the exact SDK version** (`npm i --save-exact`). A later release can change a type or method, and `^` picks it up on the next `npm i`.
- **Take scope strings from `npx @north-light/sdk apps asks`, the console's Add permissions list or `providers.tools`.** Never invent one. Tool names and arguments also come from `providers.tools('<provider>')`.
- **Never print, paste, log or commit `local/app-key.json`, `~/.config/northlight/credentials.json` or any `nld_` value.** `local/` is in `.gitignore`. If the app key leaks, add a new key in the console, switch to it, and retire the old one.
- **Do not run `logout` unless the person asks.** It revokes the login on the server and removes it from `~/.config/northlight/credentials.json` (the file stays, with no login in it); the next session must ask them to approve again.
- **Deleting an app, listing it in the marketplace, its monthly spend cap and sharing are the person's, in the console** (`https://account.northlight.ai/console`). Name the page; do not try the CLI, which refuses. On a verified app, signing keys, the JWKS URL, redirect URIs and the run notice URL change there too ([Manage your app](https://sdk.docs.northlight.ai/docs/guides/manage-your-app.md)).
- **Use `oauth.client(userId)` for a person's runtime. Never `new Crouter()`.** `Crouter` is the client for a runtime you run yourself, not for apps.
- **Use a persistent `ConnectionStore` in production.** `MemoryConnectionStore` loses every sign-in on restart and does not work across processes. `@north-light/sdk/stores/postgres` is the production store.
- **Use `runs.parse` with a schema for data. Never parse `runs.trace`.** The trace is what the model said; `output_parsed` is a value checked against your schema.
- **`426 runtime_version_unsupported` means the SDK is newer than production.** Install the previous version (`npm view @north-light/sdk versions`) with `--save-exact`.
- **Handle a refused connection in one place** with the `onRefusal` option of `OAuth2Client`; `grant_removed` is the only code on which you may delete a person's data.
- **Do not claim the app is hosted by Northlight.** The server runs where the developer puts it.

## The CLI

`npx @north-light/sdk <command>`. None needs crtr unless noted.

| Command | Effect | Needs crtr |
|---|---|---|
| `init [dir] [--agent claude|agents|all] [--global-skill]` | Scaffold a Northlight app in an empty or new directory (server.ts, key, env file, skill), or add the SDK, a key and the skill to an existing project. Never overwrites a file. | No |
| `skill [--agent claude|agents|all] [--global] [--print]` | Write the packaged `northlight` skill into `.agents/skills` and `.claude/skills` (or `~/` with `--global`), replacing an older copy. `--print` writes it to stdout. | No |
| `keygen [--out <path>] [--app <client id>] [--yes]` | Write a private signing key to `local/app-key.json` (mode 0600) and print the public JWK to register. | Only with `--app` |
| `env --client-id <client id> [--origin <url>] [--issuer <url>] [--out <path>]`<br>`env --app <client id> [--out <path>]` | Write `CROUTER_ISSUER`, `CROUTER_CLIENT_ID` and `APP_ORIGIN` into `local/app.env`, keeping every other line. `--client-id` makes no network call; `--app` reads them through crtr. | Only with `--app` |
| `login [--no-browser] [--new] [--issuer <url>]` | Log this computer in to your Northlight account: prints a link and a code, you approve once in the browser, and a revocable login is saved to `~/.config/northlight/credentials.json`. Run it again if it times out or is interrupted: it resumes the same code. When this computer is already logged in it says so and exits 0; `--new` logs in again. Calls only the Northlight directory. | No |
| `logout [--issuer <url>]` | Revoke this computer's login on the server and remove it from the credentials file (the file stays, without that login). | No |
| `whoami [--issuer <url>]` | Show the account this computer is logged in as and when the login expires. Exits 1 when not logged in. | No |
| `register [--name <text>] [--scope <scope>]... [--logo <url>] [--justification <text>] [--redirect-uri <uri>]... [--issuer <url>]` | Run in a project made by `init`, after `login`: registers the app with the public key from `local/app-key.json`, adds each `--scope` beyond `crtr:llm crtr:act`, and writes `CROUTER_CLIENT_ID` and `CROUTER_ISSUER` to `local/app.env`. | No |
| `apps <leaf> [--app <client id>] [--issuer <url>] [leaf flags] [--json]` | Call one app-management leaf with the login and print its answer as JSON. Leaves: `mine`, `get`, `update`, `set-logo`, `set-brand-color`, `set-redirect-uris`, `asks`, `set-scopes`, `set-requires`, `set-run-notice-url`, `keys list|add|retire|delete|set-jwks-uri|remove-jwks-uri`, `testers list|add|remove`. `--app` defaults to `CROUTER_CLIENT_ID` in `local/app.env`; `keys add` takes `--key-file <path>` and sends only the public half. Deleting an app, its marketplace listing, spend cap, sharing and provider role are console-only. | No |

## Pages

Read a page as markdown by adding `.md` to its URL. The whole site as one file: https://sdk.docs.northlight.ai/llms-full.txt.

- [Quick setup](https://sdk.docs.northlight.ai/docs/quickstart.md)
- [Use your coding agent](https://sdk.docs.northlight.ai/docs/coding-agents.md)
- [Where your app runs](https://sdk.docs.northlight.ai/docs/how-it-fits.md)
- [Apps and sign-in](https://sdk.docs.northlight.ai/docs/concepts/apps-and-sign-in.md)
- [Scopes and grants](https://sdk.docs.northlight.ai/docs/concepts/scopes-and-grants.md)
- [Connections](https://sdk.docs.northlight.ai/docs/concepts/connections.md)
- [Runs](https://sdk.docs.northlight.ai/docs/concepts/runs.md)
- [Testing mode](https://sdk.docs.northlight.ai/docs/concepts/testing-mode.md)
- [Providers](https://sdk.docs.northlight.ai/docs/concepts/providers.md)
- [Typed results](https://sdk.docs.northlight.ai/docs/guides/typed-results.md)
- [Stream a run](https://sdk.docs.northlight.ai/docs/guides/stream-a-run.md)
- [Background runs](https://sdk.docs.northlight.ai/docs/guides/background-runs.md)
- [Many users](https://sdk.docs.northlight.ai/docs/guides/many-users.md)
- [Grant changes](https://sdk.docs.northlight.ai/docs/guides/grant-changes.md)
- [Files and documents](https://sdk.docs.northlight.ai/docs/guides/files-and-documents.md)
- [Test your app](https://sdk.docs.northlight.ai/docs/guides/test-your-app.md)
- [Manage your app](https://sdk.docs.northlight.ai/docs/guides/manage-your-app.md)
- [Go live](https://sdk.docs.northlight.ai/docs/guides/go-live.md)
- [Providers index](https://sdk.docs.northlight.ai/docs/providers.md)
- [Texting (sms)](https://sdk.docs.northlight.ai/docs/providers/sms.md)
- [Errors](https://sdk.docs.northlight.ai/docs/errors.md)
- [CLI reference](https://sdk.docs.northlight.ai/docs/cli.md)
- [Release notes](https://sdk.docs.northlight.ai/docs/release-notes.md)
