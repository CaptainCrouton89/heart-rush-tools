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

test('separate db and sessionDb: sign-in materializes local user, shares session, keeps connections per site', async () => {
  const second = await openTestDb()
  try {
    const dir = await createFakeDirectory()
    const tools = makeAuth(db, dir, { cookieDomain: '.heartrush.party' })
    const play = makeAuth(second.db, dir, { sessionDb: db, cookieDomain: '.heartrush.party' })
    const signedIn = await signIn(tools, dir, { userId: 'user:shared', name: 'Shared', email: 'shared@example.com' })
    const sid = named(signedIn, 'hr_session').find((c) => /Domain=/.test(c))!.split(';')[0].split('=')[1]
    const request = new Request('https://play.heartrush.party/', { headers: cookieHeader(`hr_session=${sid}`) })
    assert.equal((await second.db.prepare('SELECT COUNT(*) AS n FROM user').first<{ n: number }>())!.n, 0)
    assert.deepEqual(await play.getSession(request), { userId: 'user:shared', displayName: 'Shared' })
    assert.deepEqual(
      await second.db.prepare('SELECT display_name, email FROM user WHERE id = ?').bind('user:shared').first(),
      { display_name: 'Shared', email: 'shared@example.com' },
    )
    assert.equal((await second.db.prepare('SELECT COUNT(*) AS n FROM session').first<{ n: number }>())!.n, 0)
    assert.equal((await second.db.prepare('SELECT COUNT(*) AS n FROM connection').first<{ n: number }>())!.n, 0)
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM connection WHERE user_id = ?').bind('user:shared').first<{ n: number }>())!.n, 1)
    const result = await play.runMaintenance()
    assert.equal(result.sessionsDeleted, 0)
    assert.deepEqual(await tools.getSession(request), { userId: 'user:shared', displayName: 'Shared' })
    const logout = await play.logout(new Request('https://play.heartrush.party/auth/logout', { method: 'POST', headers: cookieHeader(`hr_session=${sid}`) }))
    assert.equal(logout.status, 303)
    assert.equal(await tools.getSession(request), null)
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM user WHERE id = ?').bind('user:shared').first<{ n: number }>())!.n, 1)
  } finally {
    await second.dispose()
  }
})

test('a callback on the other site rotates a shared session without a prior local user and saves only its local connection', async () => {
  const second = await openTestDb()
  try {
    const dir = await createFakeDirectory()
    const tools = makeAuth(db, dir, { cookieDomain: '.heartrush.party' })
    const play = makeAuth(second.db, dir, { sessionDb: db, cookieDomain: '.heartrush.party' })
    const original = await signIn(tools, dir, { userId: 'user:rotate', name: 'First' })
    const oldId = named(original, 'hr_session').find((c) => /Domain=/.test(c))!.split(';')[0].split('=')[1]
    const rotated = await signIn(play, dir, { userId: 'user:rotate', name: 'Second', email: 'rotated@example.com' }, [`hr_session=${oldId}`])
    assert.equal(rotated.status, 303)
    const newId = named(rotated, 'hr_session').find((c) => /Domain=/.test(c))!.split(';')[0].split('=')[1]
    assert.notEqual(newId, oldId)
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM session WHERE id = ?').bind(oldId).first<{ n: number }>())!.n, 0)
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM session WHERE id = ?').bind(newId).first<{ n: number }>())!.n, 1)
    assert.equal((await second.db.prepare('SELECT COUNT(*) AS n FROM session').first<{ n: number }>())!.n, 0)
    assert.deepEqual(
      await second.db.prepare('SELECT display_name, email FROM user WHERE id = ?').bind('user:rotate').first(),
      { display_name: 'Second', email: 'rotated@example.com' },
    )
    assert.equal((await second.db.prepare('SELECT COUNT(*) AS n FROM connection WHERE user_id = ?').bind('user:rotate').first<{ n: number }>())!.n, 1)
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM connection WHERE user_id = ?').bind('user:rotate').first<{ n: number }>())!.n, 1)
    assert.equal((await second.db.prepare('SELECT COUNT(*) AS n FROM auth_pending').first<{ n: number }>())!.n, 0)
    const request = new Request('https://tools.heartrush.party/', { headers: cookieHeader(`hr_session=${newId}`) })
    assert.deepEqual(await tools.getSession(request), { userId: 'user:rotate', displayName: 'Second' })
  } finally {
    await second.dispose()
  }
})

test('getSession does not claim sign-in if local user materialization fails', async () => {
  const second = await openTestDb()
  try {
    const dir = await createFakeDirectory()
    const tools = makeAuth(db, dir)
    const play = makeAuth(second.db, dir, { sessionDb: db })
    const sid = named(await signIn(tools, dir, { userId: 'user:fail', name: 'F' }), 'hr_session')[0].split(';')[0].split('=')[1]
    await second.db.prepare('DROP TABLE user').run()
    await assert.rejects(() => play.getSession(new Request('https://play.heartrush.party/', { headers: cookieHeader(`hr_session=${sid}`) })))
  } finally {
    await second.dispose()
  }
})
