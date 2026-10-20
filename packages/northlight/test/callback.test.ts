import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { openTestDb, createFakeDirectory, makeAuth, signIn, sessionIdOf, cookieHeader, REDIRECT } from './fake-directory'
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
  await db.prepare('DELETE FROM auth_pending').run()
})

const userRow = (id: string) => db.prepare('SELECT display_name, email FROM user WHERE id = ?').bind(id).first<{ display_name: string; email: string | null }>()

test('callback with an ID token without email stores email NULL and signs in', async () => {
  const dir = await createFakeDirectory()
  const auth = makeAuth(db, dir)
  const res = await signIn(auth, dir, { userId: 'user:phone', name: 'Phone Only' })
  assert.equal(res.status, 303)
  const sid = sessionIdOf(res)
  assert.deepEqual(await userRow('user:phone'), { display_name: 'Phone Only', email: null })
  const session = await auth.getSession(new Request('https://play.heartrush.party/', { headers: cookieHeader(`hr_session=${sid}`) }))
  assert.deepEqual(session, { userId: 'user:phone', displayName: 'Phone Only' })
})

test('callback with an email-bearing ID token stores the email', async () => {
  const dir = await createFakeDirectory()
  const auth = makeAuth(db, dir)
  const res = await signIn(auth, dir, { userId: 'user:mail', name: 'Mail', email: 'mail@example.com' })
  assert.equal(res.status, 303)
  assert.deepEqual(await userRow('user:mail'), { display_name: 'Mail', email: 'mail@example.com' })
})

test('a later email-less sign-in keeps the stored email', async () => {
  const dir = await createFakeDirectory()
  const auth = makeAuth(db, dir)
  await signIn(auth, dir, { userId: 'user:mail', name: 'Mail', email: 'mail@example.com' })
  await signIn(auth, dir, { userId: 'user:mail', name: 'Mail 2' })
  assert.deepEqual(await userRow('user:mail'), { display_name: 'Mail 2', email: 'mail@example.com' })
})

test('callback requires the transaction cookie of the browser that started sign-in', async () => {
  const dir = await createFakeDirectory()
  const auth = makeAuth(db, dir)
  const res = await auth.callback(new Request(`${REDIRECT}?code=x&state=abc`))
  assert.equal(res.status, 400)
})

test('callback rotates the session the browser presented', async () => {
  const dir = await createFakeDirectory()
  const auth = makeAuth(db, dir)
  const first = sessionIdOf(await signIn(auth, dir, { userId: 'user:r', name: 'R' }))
  const second = sessionIdOf(await signIn(auth, dir, { userId: 'user:r', name: 'R' }, [`hr_session=${first}`]))
  assert.notEqual(first, second)
  const rows = await db.prepare('SELECT id FROM session WHERE user_id = ?').bind('user:r').all<{ id: string }>()
  assert.deepEqual(rows.results.map((r) => r.id), [second])
})
