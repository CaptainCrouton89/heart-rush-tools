import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { openTestDb, createFakeDirectory, makeAuth, signIn, setCookies, cookieHeader } from './fake-directory'
import type { D1 } from '../src/d1'

let t: Awaited<ReturnType<typeof openTestDb>>
let db: D1
before(async () => {
  t = await openTestDb()
  db = t.db
})
after(() => t.dispose())
beforeEach(async () => {
  await db.prepare('DELETE FROM user').run()
})

const named = (res: Response, name: string) => setCookies(res).filter((c) => c.startsWith(`${name}=`))

test('with cookieDomain the callback writes the session on the domain, clears the host-only one, and keeps _tx host-only', async () => {
  const dir = await createFakeDirectory()
  const auth = makeAuth(db, dir, { cookieDomain: '.heartrush.party' })
  const res = await signIn(auth, dir, { userId: 'user:a', name: 'A' })
  const session = named(res, 'hr_session')
  assert.equal(session.length, 2)
  const set = session.find((c) => /Domain=/.test(c))!
  assert.match(set, /^hr_session=[^;]+; Path=\/; Domain=\.heartrush\.party; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/)
  const clear = session.find((c) => !/Domain=/.test(c))!
  assert.equal(clear, 'hr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure')
  const tx = named(res, 'hr_session_tx')
  assert.equal(tx.length, 1)
  assert.doesNotMatch(tx[0], /Domain=/)
})

test('with cookieDomain the login transaction cookie is host-only', async () => {
  const dir = await createFakeDirectory()
  const auth = makeAuth(db, dir, { cookieDomain: '.heartrush.party' })
  const res = await auth.login(new Request('https://play.heartrush.party/auth/login'))
  assert.doesNotMatch(named(res, 'hr_session_tx')[0], /Domain=/)
})

test('with cookieDomain logout clears the domain cookie and the host-only cookie and deletes the session', async () => {
  const dir = await createFakeDirectory()
  const auth = makeAuth(db, dir, { cookieDomain: '.heartrush.party' })
  const signedIn = await signIn(auth, dir, { userId: 'user:a', name: 'A' })
  const sid = named(signedIn, 'hr_session').find((c) => /Domain=/.test(c))!.split(';')[0].split('=')[1]
  const res = await auth.logout(new Request('https://play.heartrush.party/auth/logout', { method: 'POST', headers: cookieHeader(`hr_session=${sid}`) }))
  const session = named(res, 'hr_session')
  assert.equal(session.length, 2)
  assert.ok(session.every((c) => /Max-Age=0/.test(c)))
  assert.equal(session.filter((c) => /Domain=\.heartrush\.party/.test(c)).length, 1)
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM session').first<{ n: number }>())!.n, 0)
})

test('without cookieDomain the cookies are unchanged: one host-only session cookie', async () => {
  const dir = await createFakeDirectory()
  const auth = makeAuth(db, dir)
  const res = await signIn(auth, dir, { userId: 'user:a', name: 'A' })
  const session = named(res, 'hr_session')
  assert.equal(session.length, 1)
  assert.match(session[0], /^hr_session=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000; Secure$/)
  const out = await auth.logout(new Request('https://play.heartrush.party/auth/logout', { method: 'POST' }))
  assert.deepEqual(named(out, 'hr_session'), ['hr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure'])
})
