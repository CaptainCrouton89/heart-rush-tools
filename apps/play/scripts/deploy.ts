/**
 * Play's deploy: test → build → remote D1 migrations → upload a version → deploy it at 0% beside the live one →
 * checks against play.heartrush.party pinned to the new version → promote it to 100%.
 * Any failed step stops the run before promotion. A failure after the 0% deployment leaves the live version at 100%
 * and the new version in the deployment at 0%; the log and the exit message say so.
 *
 * Why not a preview URL: Cloudflare creates no Version URL for a Worker that exports a Durable Object (CampaignChannel),
 * so the checks use the `Cloudflare-Workers-Version-Overrides` header, which reaches any version in the current deployment.
 * The build runs before the upload because `wrangler versions upload` reads the config that `vite build` writes to dist/server.
 * The step log goes to stdout and to $DEPLOY_LOG (default apps/play/.wrangler/deploy-<timestamp>.log).
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const logPath = process.env.DEPLOY_LOG ?? resolve(appDir, '.wrangler', `deploy-${new Date().toISOString().replace(/[:.]/g, '')}.log`)
mkdirSync(dirname(logPath), { recursive: true })

const AUTH_DB = 'heartrush-tools'
const PLAY_DB = 'heartrush-play'
const COOKIE = 'hr_session'
const WORKER = 'heartrush-play'
const HOST = 'https://play.heartrush.party'
/** Workers free plan: heavy SSR can fail with error 1102 (HTTP 503) — a check is retried this many times and every failure is logged. */
const ATTEMPTS = 5

function log(line: string) {
  const text = `[${new Date().toISOString()}] ${line}`
  console.log(text)
  appendFileSync(logPath, text + '\n')
}

function run(label: string, cmd: string, args: string[]): string {
  log(`STEP ${label}: ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { cwd: appDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const out = (r.stdout ?? '') + (r.stderr ?? '')
  appendFileSync(logPath, out + '\n')
  if (r.status !== 0) {
    console.error(out)
    throw new Error(`${label} failed (exit ${r.status}); nothing was promoted`)
  }
  log(`OK ${label}`)
  return out
}

const sql = (db: string, command: string) =>
  run(`d1 execute ${db}`, 'pnpm', ['exec', 'wrangler', 'd1', 'execute', db, '--remote', '--command', command])

type Fetched = { status: number; location: string | null; body: string }

async function fetchPinned(url: string, versionId: string | null, cookie?: string): Promise<Fetched> {
  const res = await fetch(url, {
    redirect: 'manual',
    headers: {
      accept: 'text/html',
      ...(versionId ? { 'cloudflare-workers-version-overrides': `${WORKER}="${versionId}"` } : {}),
      ...(cookie ? { cookie } : {}),
    },
  })
  return { status: res.status, location: res.headers.get('location'), body: await res.text() }
}

/** Run one check up to ATTEMPTS times; a 503/1102 response is retried and counted, any other failure is final. */
async function check(name: string, url: string, versionId: string, cookie: string | undefined, accept: (r: Fetched) => string | null) {
  let failures1102 = 0
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const r = await fetchPinned(url, versionId, cookie)
    if (r.status === 503 || r.body.includes('1102')) {
      failures1102++
      log(`CHECK ${name} attempt ${attempt}/${ATTEMPTS}: status ${r.status}, error 1102 (resource limits)`)
      continue
    }
    const problem = accept(r)
    if (problem) throw new Error(`check ${name} failed: ${problem} (status ${r.status}, location ${r.location}); nothing was promoted`)
    log(`CHECK ${name} PASS on attempt ${attempt}: status ${r.status}${r.location ? ` location ${r.location}` : ''}; 1102 failures before pass: ${failures1102}`)
    return
  }
  throw new Error(`check ${name} failed: error 1102 on all ${ATTEMPTS} attempts; nothing was promoted`)
}

/** Static asset paths a page links to; content-hashed, so they identify the build that served the page. */
const assetsIn = (html: string) => [...new Set(html.match(/\/assets\/[\w.-]+\.(?:js|css)/g) ?? [])].sort()

function liveVersionId(): string {
  const out = run('current deployment', 'pnpm', ['exec', 'wrangler', 'deployments', 'status', '--json'])
  const json = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) as { versions: { version_id: string; percentage: number }[] }
  if (json.versions.length !== 1 || json.versions[0].percentage !== 100) {
    throw new Error(`the current deployment is not a single version at 100% (${JSON.stringify(json.versions)}); resolve it first`)
  }
  return json.versions[0].version_id
}

/**
 * The override header is ignored silently when it does not apply, so prove it applied: the page served with the header
 * must link only to assets this build produced (dist/client/assets). A page from another build links to other hashes.
 */
async function assertPinned(newId: string, liveId: string) {
  const built = new Set(readdirSync(resolve(appDir, 'dist', 'client', 'assets')).map((f) => `/assets/${f}`))
  const pinned = assetsIn((await fetchPinned(`${HOST}/`, newId)).body)
  const live = assetsIn((await fetchPinned(`${HOST}/`, null)).body)
  if (pinned.length === 0) throw new Error('the pinned page links no assets, so the version cannot be identified')
  const foreign = pinned.filter((a) => !built.has(a))
  if (foreign.length) throw new Error(`the override header did not reach the new version: the page links assets not in this build (${foreign.join(', ')})`)
  const same = pinned.join() === live.join()
  log(`PINNED: override page links ${pinned.length} assets, all from this build; live page ${same ? 'links the same assets (identical bundle, nothing to tell the versions apart)' : 'links different assets'}`)
}

async function main() {
  log(`deploy log: ${logPath}`)
  if (!existsSync(resolve(appDir, 'package.json'))) throw new Error('wrong working directory')
  run('play tests', 'pnpm', ['run', 'test'])
  run('build', 'pnpm', ['run', 'build'])
  run('remote D1 migrations', 'pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', PLAY_DB, '--remote'])

  const liveId = liveVersionId()
  log(`live version ${liveId}`)
  const upload = run('versions upload', 'pnpm', ['exec', 'wrangler', 'versions', 'upload', '--message', 'deploy.ts'])
  const newId = upload.match(/Worker Version ID:\s*(\S+)/)?.[1]
  if (!newId) throw new Error('versions upload printed no Worker Version ID; nothing was deployed')
  log(`new version ${newId}`)
  if (newId === liveId) throw new Error('the uploaded version is the live version')

  run('deploy new version at 0%', 'pnpm', ['exec', 'wrangler', 'versions', 'deploy', `${liveId}@100`, `${newId}@0`, '--yes', '--message', 'deploy.ts: checks at 0%'])
  let zeroPercentDeployed = true
  try {
    // The override applies only once the deployment has propagated.
    for (let i = 0; i < 10; i++) {
      try {
        await assertPinned(newId, liveId)
        break
      } catch (e) {
        if (i === 9) throw e
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
    await check('/health', `${HOST}/health`, newId, undefined, (r) => (r.status === 200 ? null : 'expected 200'))
    await check('/characters signed out', `${HOST}/characters`, newId, undefined, (r) =>
      (r.status === 302 || r.status === 307) && r.location?.includes('/auth/login?returnTo=') ? null : 'expected a 302/307 redirect to /auth/login?returnTo=…',
    )

    // A throwaway user and session in the shared auth database; removed afterwards (play's materialized copy of the user too).
    const userId = `user:deploycheck${randomBytes(4).toString('hex')}`
    const sid = randomBytes(16).toString('base64url')
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    sql(AUTH_DB, `INSERT INTO user (id, display_name) VALUES ('${userId}', 'Deploy check'); INSERT INTO session (id, user_id, expires_at) VALUES ('${sid}', '${userId}', '${expires}')`)
    try {
      await check('/characters signed in', `${HOST}/characters`, newId, `${COOKIE}=${sid}`, (r) => (r.status === 200 ? null : 'expected 200'))
    } finally {
      sql(AUTH_DB, `DELETE FROM session WHERE user_id = '${userId}'; DELETE FROM user WHERE id = '${userId}'`)
      sql(PLAY_DB, `DELETE FROM user WHERE id = '${userId}'`)
    }

    run('promote', 'pnpm', ['exec', 'wrangler', 'versions', 'deploy', `${newId}@100`, '--yes', '--message', 'deploy.ts: promote'])
    zeroPercentDeployed = false
    log(`PROMOTED version ${newId} (previous ${liveId})`)
  } catch (e) {
    if (zeroPercentDeployed) log(`NOT PROMOTED: live version ${liveId} still serves 100%; version ${newId} is still in the deployment at 0%`)
    throw e
  }
}

main().catch((e) => {
  log(`FAILED: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
