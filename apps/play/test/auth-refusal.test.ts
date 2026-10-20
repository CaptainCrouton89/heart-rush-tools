import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { CrouterError } from '@north-light/sdk'
import { createFakeDirectory, makeAuth, signIn, sessionIdOf, cookieHeader, setCookies } from '../../../packages/northlight/test/fake-directory'
import { openPlayDbs, type D1 } from './db'

let t: Awaited<ReturnType<typeof openPlayDbs>>
let play: D1
let shared: D1 // AUTH_DB, which is also tools' own database
before(async () => {
  t = await openPlayDbs()
  play = t.DB
  shared = t.AUTH_DB
})
after(() => t.dispose())
beforeEach(async () => {
  await play.prepare('DELETE FROM campaign').run()
  await play.prepare('DELETE FROM character').run()
  await play.prepare('DELETE FROM user').run()
  await shared.prepare('DELETE FROM user').run()
})

const count = async (db: D1, table: string, userId: string) =>
  (await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table === 'user' ? 'id' : 'user_id'} = ?`).bind(userId).first<{ n: number }>())!.n

/** Tools (default session store: AUTH_DB) and play (DB + sessionDb AUTH_DB), both against one fake Northlight directory. */
async function sites() {
  const dir = await createFakeDirectory()
  return {
    dir,
    tools: makeAuth(shared, dir),
    play: makeAuth(play, dir, { sessionDb: shared, scopes: ['openid', 'profile', 'email', 'crtr:llm', 'crtr:act'] }),
  }
}

test('signing in on play makes a shared session, play\'s own user and connection, and no row in play\'s session table', async () => {
  const { dir, tools, play: playAuth } = await sites()
  const res = await signIn(playAuth, dir, { userId: 'user:a', name: 'A', email: 'a@example.com' })
  const sid = sessionIdOf(res)
  assert.equal(await count(shared, 'session', 'user:a'), 1)
  assert.equal(await count(play, 'session', 'user:a'), 0)
  assert.equal(await count(play, 'user', 'user:a'), 1)
  assert.equal(await count(play, 'connection', 'user:a'), 1)
  assert.equal(await count(shared, 'connection', 'user:a'), 0) // tools has no AI connection until someone signs in there
  // tools recognizes the same cookie without consent, and so does play
  const asTools = await tools.getSession(new Request('https://tools.heartrush.party/', { headers: cookieHeader(`hr_session=${sid}`) }))
  assert.deepEqual(asTools, { userId: 'user:a', displayName: 'A' })
  // logout through tools signs play out
  await tools.logout(new Request('https://tools.heartrush.party/auth/logout', { method: 'POST', headers: cookieHeader(`hr_session=${sid}`) }))
  assert.equal(await playAuth.getSession(new Request('https://play.heartrush.party/', { headers: cookieHeader(`hr_session=${sid}`) })), null)
})

test('a session created on tools gives play the user without a play sign-in, and play materializes the local user row', async () => {
  const { dir, tools, play: playAuth } = await sites()
  const sid = sessionIdOf(await signIn(tools, dir, { userId: 'user:b', name: 'B' }))
  assert.equal(await count(play, 'user', 'user:b'), 0)
  const session = await playAuth.getSession(new Request('https://play.heartrush.party/', { headers: cookieHeader(`hr_session=${sid}`) }))
  assert.deepEqual(session, { userId: 'user:b', displayName: 'B' })
  assert.equal(await count(play, 'user', 'user:b'), 1)
  assert.equal(await count(play, 'connection', 'user:b'), 0)
})

test('production cookie scope: play\'s session cookie is on .heartrush.party, the transaction cookie is host-only', async () => {
  const dir = await createFakeDirectory()
  const auth = makeAuth(play, dir, { sessionDb: shared, cookieDomain: '.heartrush.party' })
  const login = await auth.login(new Request('https://play.heartrush.party/auth/login'))
  assert.match(setCookies(login).find((c) => c.startsWith('hr_session_tx='))!, /^(?!.*Domain=)/)
  const res = await signIn(auth, dir, { userId: 'user:c', name: 'C' })
  assert.match(setCookies(res).find((c) => c.startsWith('hr_session=') && c.includes('Domain='))!, /Domain=\.heartrush\.party/)
})

async function seedGameRows(userId: string) {
  await play.prepare("INSERT INTO campaign (id, name, gm_user_id) VALUES ('camp', 'Camp', ?)").bind(userId).run()
  await play.prepare("INSERT INTO campaign_member (campaign_id, user_id, role) VALUES ('camp', ?, 'gm')").bind(userId).run()
  await play.prepare("INSERT INTO character (id, owner_user_id, campaign_id, name, state) VALUES ('ch', ?, 'camp', 'N', '{}')").bind(userId).run()
}

async function refuse(code: string) {
  const { dir, tools, play: playAuth } = await sites()
  await signIn(tools, dir, { userId: 'user:both', name: 'Both' })
  await signIn(playAuth, dir, { userId: 'user:both', name: 'Both' })
  await seedGameRows('user:both')
  await play.prepare("UPDATE connection SET access_token_expires_at = '2000-01-01T00:00:00.000Z'").run()
  dir.refuseRefresh(code)
  await assert.rejects(async () => (await playAuth.runtimeFor('user:both')).runs.start({ prompt: 'x' } as never))
  return playAuth
}

test('a removed refusal on play deletes the shared sessions and only play\'s connection, and keeps the game rows', async () => {
  await refuse('grant_removed')
  assert.equal(await count(shared, 'session', 'user:both'), 0)
  assert.equal(await count(play, 'connection', 'user:both'), 0)
  assert.equal(await count(shared, 'connection', 'user:both'), 1) // tools' connection survives
  assert.equal(await count(shared, 'user', 'user:both'), 1)
  assert.equal(await count(play, 'user', 'user:both'), 1)
  for (const [table, where] of [['campaign', "id = 'camp'"], ['campaign_member', "campaign_id = 'camp'"], ['character', "id = 'ch'"]])
    assert.equal((await play.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).first<{ n: number }>())!.n, 1, table)
})

test('a paused refusal keeps the shared sessions and removes only play\'s connection (ruling 18)', async () => {
  const playAuth = await refuse('grant_suspended')
  assert.equal(await count(shared, 'session', 'user:both'), 2)
  assert.equal(await count(play, 'connection', 'user:both'), 0)
  assert.equal(await count(shared, 'connection', 'user:both'), 1)
  await assert.rejects(
    () => playAuth.runtimeFor('user:both'),
    (e: unknown) => e instanceof CrouterError && /not_connected/.test(`${e.code}${e.message}`),
  )
  assert.equal((await play.prepare("SELECT COUNT(*) AS n FROM character WHERE id = 'ch'").first<{ n: number }>())!.n, 1)
})
