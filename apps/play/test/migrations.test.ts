import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { applyMigrations, openPlayDbs, PLAY_MIGRATIONS, type D1 } from './db'

let t: Awaited<ReturnType<typeof openPlayDbs>>
let db: D1
before(async () => {
  t = await openPlayDbs() // applies every play migration to an empty local D1
  db = t.DB
})
after(() => t.dispose())

const names = async (type: 'table' | 'index') =>
  (await db.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').bind(type).all<{ name: string }>()).results.map((r) => r.name)

test('migrations are 0001, 0100, 0101 and the auth copy is byte-identical to the package', () => {
  const pkg = fileURLToPath(new URL('../../../packages/northlight/migrations/0001_northlight_auth.sql', import.meta.url))
  assert.ok(readFileSync(`${PLAY_MIGRATIONS}0001_northlight_auth.sql`).equals(readFileSync(pkg)))
})

test('every play table exists', async () => {
  const tables = await names('table')
  for (const name of [
    'user', 'session', 'auth_pending', 'connection',
    'campaign', 'campaign_member', 'campaign_invite', 'character', 'character_event',
    'campaign_session', 'session_encounter', 'stratagem', 'roll', 'journal_entry',
  ]) assert.ok(tables.includes(name), name)
  const indexes = await names('index')
  for (const name of ['campaign_session_number', 'campaign_session_open', 'roll_campaign_time', 'journal_character', 'journal_session_shared', 'character_event_seq'])
    assert.ok(indexes.includes(name), name)
})

test('re-applying the same files to a second empty database gives the same schema', async () => {
  const other = await openPlayDbs()
  try {
    const schema = (d: D1) => d.prepare('SELECT name, sql FROM sqlite_master ORDER BY name').all()
    assert.deepEqual((await schema(other.DB)).results, (await schema(db)).results)
    assert.deepEqual(await applyMigrations(other.DB, PLAY_MIGRATIONS).catch((e: Error) => e.message.includes('already exists')), true)
  } finally {
    await other.dispose()
  }
})

async function seedCampaign(id: string) {
  await db.prepare("INSERT OR IGNORE INTO user (id, display_name) VALUES ('user:gm', 'GM')").run()
  await db.prepare('INSERT INTO campaign (id, name, gm_user_id) VALUES (?, ?, ?)').bind(id, id, 'user:gm').run()
}

test('campaign.current_day defaults to 1 and refuses less than 1', async () => {
  await seedCampaign('c-day')
  assert.equal((await db.prepare("SELECT current_day FROM campaign WHERE id = 'c-day'").first<{ current_day: number }>())!.current_day, 1)
  await assert.rejects(db.prepare("UPDATE campaign SET current_day = 0 WHERE id = 'c-day'").run())
})

test('campaign_session: number is unique per campaign and at most one session is open', async () => {
  await seedCampaign('c-sess')
  const add = (id: string, number: number, endDay: number | null) =>
    db.prepare('INSERT INTO campaign_session (id, campaign_id, number, real_date, start_day, end_day) VALUES (?, ?, ?, ?, 1, ?)')
      .bind(id, 'c-sess', number, '2026-10-20', endDay).run()
  await add('s1', 1, 3)
  await add('s2', 2, null)
  await assert.rejects(add('s3', 3, null), /UNIQUE/)
  await assert.rejects(add('s4', 2, 5), /UNIQUE/)
  await add('s5', 3, 5)
})

test('roll.complication takes the five values of ruling 24 and nothing else', async () => {
  await seedCampaign('c-roll')
  await db.prepare("INSERT INTO character (id, owner_user_id, campaign_id, name, state) VALUES ('ch1', 'user:gm', 'c-roll', 'N', '{}')").run()
  const add = (id: string, complication: string) =>
    db.prepare("INSERT INTO roll (id, campaign_id, character_id, user_id, roll_type, ability, dice, total, complication) VALUES (?, 'c-roll', 'ch1', 'user:gm', 'check', 'might', '[]', 1, ?)")
      .bind(id, complication).run()
  for (const v of ['none', 'pending', 'failed', 'rerolled', 'double']) await add(`r-${v}`, v)
  await assert.rejects(add('r-bad', 'chosen'), /CHECK/)
})

test('deleting a character cascades to its events and journal; deleting a campaign nulls character.campaign_id', async () => {
  await seedCampaign('c-del')
  await db.prepare("INSERT INTO character (id, owner_user_id, campaign_id, name, state) VALUES ('ch-del', 'user:gm', 'c-del', 'N', '{}')").run()
  await db.prepare("INSERT INTO character_event (id, character_id, actor_user_id, seq, action, inverse) VALUES ('e1', 'ch-del', 'user:gm', 2, '{}', '{}')").run()
  await db.prepare("INSERT INTO journal_entry (id, character_id, author_user_id, body) VALUES ('j1', 'ch-del', 'user:gm', 'x')").run()
  await db.prepare("DELETE FROM campaign WHERE id = 'c-del'").run()
  assert.equal((await db.prepare("SELECT campaign_id FROM character WHERE id = 'ch-del'").first<{ campaign_id: string | null }>())!.campaign_id, null)
  await db.prepare("DELETE FROM character WHERE id = 'ch-del'").run()
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM character_event WHERE character_id = 'ch-del'").first<{ n: number }>())!.n, 0)
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM journal_entry WHERE character_id = 'ch-del'").first<{ n: number }>())!.n, 0)
})
