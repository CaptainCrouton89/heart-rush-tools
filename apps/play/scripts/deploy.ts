/**
 * Play's deploy: test → build → remote D1 migrations → preview version upload → preview checks → promote.
 * Any failed step stops the run before promotion. The step log goes to stdout and to $DEPLOY_LOG
 * (default apps/play/.wrangler/deploy-<timestamp>.log).
 *
 * The build runs before the upload because `wrangler versions upload` reads the config that `vite build` generates in dist/server.
 * The preview checks run against the version's own preview URL, so a bad version never reaches play.heartrush.party.
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const logPath = process.env.DEPLOY_LOG ?? resolve(appDir, '.wrangler', `deploy-${new Date().toISOString().replace(/[:.]/g, '')}.log`)
mkdirSync(dirname(logPath), { recursive: true })

const AUTH_DB = 'heartrush-tools'
const PLAY_DB = 'heartrush-play'
const COOKIE = 'hr_session'
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

async function fetchPreview(url: string, cookie?: string): Promise<Fetched> {
  const res = await fetch(url, { redirect: 'manual', headers: { accept: 'text/html', ...(cookie ? { cookie } : {}) } })
  return { status: res.status, location: res.headers.get('location'), body: await res.text() }
}

/** Run one check up to ATTEMPTS times; a 503/1102 response is retried and counted, any other failure is final. */
async function check(name: string, url: string, cookie: string | undefined, accept: (r: Fetched) => string | null) {
  let failures1102 = 0
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const r = await fetchPreview(url, cookie)
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

async function main() {
  log(`deploy log: ${logPath}`)
  run('play tests', 'pnpm', ['run', 'test'])
  run('build', 'pnpm', ['run', 'build'])
  run('remote D1 migrations', 'pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', PLAY_DB, '--remote'])

  const upload = run('versions upload', 'pnpm', ['exec', 'wrangler', 'versions', 'upload', '--message', 'deploy.ts preview'])
  const versionId = upload.match(/Worker Version ID:\s*(\S+)/)?.[1]
  const previewUrl = upload.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0]?.replace(/\/$/, '')
  if (!versionId) throw new Error('versions upload printed no Worker Version ID; nothing was promoted')
  if (!previewUrl) throw new Error(`versions upload (version ${versionId}) printed no preview URL (no workers.dev subdomain?); nothing was promoted`)
  log(`version ${versionId}, preview ${previewUrl}`)

  await check('/health', `${previewUrl}/health`, undefined, (r) => (r.status === 200 ? null : 'expected 200'))
  await check('/characters signed out', `${previewUrl}/characters`, undefined, (r) =>
    (r.status === 302 || r.status === 307) && r.location?.includes('/auth/login?returnTo=')
      ? null
      : 'expected a 302/307 redirect to /auth/login?returnTo=…',
  )

  // A throwaway user and session in the shared auth database; removed afterwards (play's materialized copy of the user too).
  const userId = `user:deploycheck${randomBytes(4).toString('hex')}`
  const sid = randomBytes(16).toString('base64url')
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  sql(AUTH_DB, `INSERT INTO user (id, display_name) VALUES ('${userId}', 'Deploy check'); INSERT INTO session (id, user_id, expires_at) VALUES ('${sid}', '${userId}', '${expires}')`)
  try {
    await check('/characters signed in', `${previewUrl}/characters`, `${COOKIE}=${sid}`, (r) => (r.status === 200 ? null : 'expected 200'))
  } finally {
    sql(AUTH_DB, `DELETE FROM session WHERE user_id = '${userId}'; DELETE FROM user WHERE id = '${userId}'`)
    sql(PLAY_DB, `DELETE FROM user WHERE id = '${userId}'`)
  }

  run('versions deploy (promote)', 'pnpm', ['exec', 'wrangler', 'versions', 'deploy', `${versionId}@100`, '--yes', '--message', 'deploy.ts promote'])
  log(`PROMOTED version ${versionId}`)
}

main().catch((e) => {
  log(`FAILED: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
