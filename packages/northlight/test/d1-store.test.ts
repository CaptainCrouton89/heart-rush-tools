import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import type { Connection } from '@north-light/sdk'
import { D1ConnectionStore } from '../src/d1-store'
import type { D1 } from '../src/d1'

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: D1 }>>>
let db: D1

const connection = (refreshToken: string): Connection => ({
  userId: 'user:a',
  runtimeUrl: 'https://runtime.example',
  refreshToken,
  grantId: 'grant1',
  accessToken: 'at-' + refreshToken,
  accessTokenExpiresAt: Date.now() + 3600_000,
})

before(async () => {
  // A local, in-memory D1 through wrangler's platform proxy (the same workerd D1 as production).
  const dir = mkdtempSync(join(tmpdir(), 'northlight-d1-'))
  const configPath = join(dir, 'wrangler.jsonc')
  writeFileSync(
    configPath,
    JSON.stringify({
      name: 'northlight-test',
      compatibility_date: '2026-05-01',
      d1_databases: [{ binding: 'DB', database_name: 'test', database_id: '00000000-0000-0000-0000-000000000000' }],
    }),
  )
  proxy = await getPlatformProxy<{ DB: D1 }>({ configPath, persist: false })
  db = proxy.env.DB
  const sql = readFileSync(new URL('../migrations/0001_northlight_auth.sql', import.meta.url), 'utf8')
  const statements = sql.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean)
  for (const s of statements) await db.prepare(s).run()
})

after(async () => {
  await proxy.dispose()
})

async function reset() {
  await db.prepare('DELETE FROM user').run()
  await db.prepare("INSERT INTO user (id, display_name) VALUES ('user:a', 'A')").run()
}

test('save/load round-trips; remove only deletes a matching refresh token', async () => {
  await reset()
  const store = new D1ConnectionStore(db)
  await store.save(connection('r1'))
  assert.equal((await store.load('user:a'))?.refreshToken, 'r1')
  assert.equal(await store.remove('user:a', 'other'), false)
  assert.equal(await store.remove('user:a', 'r1'), true)
  assert.equal(await store.load('user:a'), null)
})

test('lock serializes holders and a second isolate waits for the first', async () => {
  await reset()
  const a = new D1ConnectionStore(db, { retryMs: 10 })
  const b = new D1ConnectionStore(db, { retryMs: 10 })
  await a.save(connection('r1'))
  const order: string[] = []
  await Promise.all([
    a.lock('user:a', async () => {
      order.push('a-in')
      await new Promise((r) => setTimeout(r, 100))
      order.push('a-out')
    }),
    (async () => {
      await new Promise((r) => setTimeout(r, 20))
      await b.lock('user:a', async () => {
        order.push('b-in')
      })
    })(),
  ])
  assert.deepEqual(order, ['a-in', 'a-out', 'b-in'])
  const row = await db.prepare('SELECT lock_token FROM connection').first<{ lock_token: string | null }>()
  assert.equal(row?.lock_token, null)
})

test('lock times out with lock_timeout while another holder keeps the lease', async () => {
  await reset()
  const a = new D1ConnectionStore(db, { retryMs: 10 })
  const b = new D1ConnectionStore(db, { retryMs: 10, attempts: 3 })
  await a.save(connection('r1'))
  await a.lock('user:a', async () => {
    await assert.rejects(b.lock('user:a', async () => undefined), /lock_timeout/)
  })
})

test('a holder whose lease expired and was taken gets lock_lost and cannot overwrite the newer token', async () => {
  await reset()
  const a = new D1ConnectionStore(db, { leaseMs: 50, renewMs: 10_000, retryMs: 10 })
  const b = new D1ConnectionStore(db, { retryMs: 10 })
  await a.save(connection('r1'))
  await a.lock('user:a', async () => {
    await new Promise((r) => setTimeout(r, 120)) // a's lease expires; renewal is disabled
    await b.lock('user:a', async () => {
      await b.save(connection('r2'))
    })
    await assert.rejects(a.save(connection('r-stale')), /lock_lost/)
  })
  assert.equal((await a.load('user:a'))?.refreshToken, 'r2')
})

test('a fresh sign-in save clears a lease so an in-flight refresh cannot save over it', async () => {
  await reset()
  const a = new D1ConnectionStore(db)
  await a.save(connection('r1'))
  await a.lock('user:a', async () => {
    await new D1ConnectionStore(db).save(connection('r-new')) // sign-in elsewhere, outside the lock
    await assert.rejects(a.save(connection('r-refresh')), /lock_lost/)
  })
  assert.equal((await a.load('user:a'))?.refreshToken, 'r-new')
})

test('listStale returns only connections not saved since the cutoff', async () => {
  await reset()
  const store = new D1ConnectionStore(db)
  await store.save(connection('r1'))
  assert.equal((await store.listStale(new Date(Date.now() - 60_000))).length, 0)
  assert.equal((await store.listStale(new Date(Date.now() + 60_000))).length, 1)
})
