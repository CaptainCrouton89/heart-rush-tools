import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { CrouterError } from '@north-light/sdk'
import { openTestDb, createFakeDirectory, makeAuth, signIn } from './fake-directory'
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

const count = async (table: string, userId: string) =>
  (await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).bind(userId).first<{ n: number }>())!.n

/** Signs in two users, forces `userId`'s access token to be stale, then makes the directory refuse the refresh. */
async function setup(code: string) {
  const dir = await createFakeDirectory()
  const auth = makeAuth(db, dir)
  await signIn(auth, dir, { userId: 'user:a', name: 'A' })
  await signIn(auth, dir, { userId: 'user:b', name: 'B' })
  await db.prepare("UPDATE connection SET access_token_expires_at = '2000-01-01T00:00:00.000Z'").run()
  dir.refuseRefresh(code)
  return auth
}

test('grant_removed refresh deletes that user\'s sessions and connection and nobody else\'s', async () => {
  const auth = await setup('grant_removed')
  assert.equal(await count('session', 'user:a'), 1)
  await assert.rejects(async () => (await auth.runtimeFor('user:a')).runs.start({ prompt: 'x' } as never))
  assert.equal(await count('session', 'user:a'), 0)
  assert.equal(await count('connection', 'user:a'), 0)
  assert.equal(await count('session', 'user:b'), 1)
  assert.equal(await count('connection', 'user:b'), 1)
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM user WHERE id = 'user:a'").first<{ n: number }>())!.n, 1)
})

test('grant_suspended keeps sessions, removes the connection, and the next runtimeFor throws not_connected', async () => {
  const auth = await setup('grant_suspended')
  await assert.rejects(async () => (await auth.runtimeFor('user:a')).runs.start({ prompt: 'x' } as never))
  assert.equal(await count('session', 'user:a'), 1)
  assert.equal(await count('connection', 'user:a'), 0)
  await assert.rejects(
    () => auth.runtimeFor('user:a'),
    (e: unknown) => e instanceof CrouterError && /not_connected/.test(`${(e as CrouterError).code}${(e as Error).message}`),
  )
})
