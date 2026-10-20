import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { openTestDb, createFakeDirectory, makeAuth, cookieHeader } from './fake-directory'
import type { D1 } from '../src/d1'

let t: Awaited<ReturnType<typeof openTestDb>>
let db: D1
const DAY = 86_400_000

before(async () => {
  t = await openTestDb()
  db = t.db
})
after(() => t.dispose())
beforeEach(async () => {
  await db.prepare('DELETE FROM user').run()
  await db.prepare("INSERT INTO user (id, display_name) VALUES ('user:a', 'A')").run()
})

const addSession = (id: string, expiresInMs: number) =>
  db.prepare('INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)').bind(id, 'user:a', new Date(Date.now() + expiresInMs).toISOString()).run()
const expiryOf = async (id: string) =>
  Date.parse((await db.prepare('SELECT expires_at FROM session WHERE id = ?').bind(id).first<{ expires_at: string }>())!.expires_at)
const req = (sid: string) => new Request('https://play.heartrush.party/', { headers: cookieHeader(`hr_session=${sid}`) })

test('touchSession extends a session with 10 days left and returns the cookie', async () => {
  const auth = makeAuth(db, await createFakeDirectory())
  await addSession('s10', 10 * DAY)
  const setCookie = await auth.touchSession(req('s10'))
  assert.ok(setCookie)
  assert.equal(setCookie?.length, 1)
  assert.match(setCookie![0], /^hr_session=s10; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/)
  const expires = await expiryOf('s10')
  assert.ok(Math.abs(expires - (Date.now() + 30 * DAY)) < 60_000)
})

test('touchSession leaves a session with 20 days left untouched', async () => {
  const auth = makeAuth(db, await createFakeDirectory())
  await addSession('s20', 20 * DAY)
  const before = await expiryOf('s20')
  assert.equal(await auth.touchSession(req('s20')), null)
  assert.equal(await expiryOf('s20'), before)
})

test('touchSession does not revive an expired session, and ignores unknown or missing cookies', async () => {
  const auth = makeAuth(db, await createFakeDirectory())
  await addSession('old', -DAY)
  const before = await expiryOf('old')
  assert.equal(await auth.touchSession(req('old')), null)
  assert.equal(await expiryOf('old'), before)
  assert.equal(await auth.touchSession(req('nope')), null)
  assert.equal(await auth.touchSession(new Request('https://play.heartrush.party/')), null)
})

test('touchSession honours sessionTtlSeconds and cookieDomain; getSession is unchanged', async () => {
  const auth = makeAuth(db, await createFakeDirectory(), { sessionTtlSeconds: 20 * 86400, cookieDomain: '.heartrush.party' })
  await addSession('sd', 5 * DAY)
  const setCookie = await auth.touchSession(req('sd'))
  assert.equal(setCookie?.length, 2)
  assert.match(setCookie![0], /Domain=\.heartrush\.party/)
  assert.match(setCookie![1], /hr_session=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0/)
  assert.match(setCookie![0], /Max-Age=1728000/)
  assert.deepEqual(await auth.getSession(req('sd')), { userId: 'user:a', displayName: 'A' })
  await addSession('sg', 5 * DAY)
  const before = await expiryOf('sg')
  await auth.getSession(req('sg'))
  assert.equal(await expiryOf('sg'), before)
})


test('touchSession migrates a 20-day host-only cookie without extending the shared row', async () => {
  const auth = makeAuth(db, await createFakeDirectory(), { cookieDomain: '.heartrush.party' })
  await addSession('precutover', 20 * DAY)
  const before = await expiryOf('precutover')
  const cookies = await auth.touchSession(req('precutover'))
  assert.equal(cookies?.length, 2)
  assert.match(cookies![0], /^hr_session=precutover; Path=\/; Domain=\.heartrush\.party/)
  assert.match(cookies![0], /Max-Age=17280[0-9]{2}/)
  assert.doesNotMatch(cookies![0], /Max-Age=2592000/)
  assert.match(cookies![1], /^hr_session=; Path=\/; HttpOnly; SameSite=Lax; Max-Age=0/)
  assert.equal(await expiryOf('precutover'), before)
  const rows = await db.prepare('SELECT COUNT(*) AS n FROM session').first<{ n: number }>()
  assert.equal(rows?.n, 1)
})
