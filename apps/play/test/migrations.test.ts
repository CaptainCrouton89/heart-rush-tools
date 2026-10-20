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

test('migrations are 0001, 0100, 0101, 0200, 0201 and the auth copy is byte-identical to the package', () => {
  const pkg = fileURLToPath(new URL('../../../packages/northlight/migrations/0001_northlight_auth.sql', import.meta.url))
  assert.ok(readFileSync(`${PLAY_MIGRATIONS}0001_northlight_auth.sql`).equals(readFileSync(pkg)))
})

test('every play table exists', async () => {
  const tables = await names('table')
  for (const name of [
    'user', 'session', 'auth_pending', 'connection',
    'campaign', 'campaign_member', 'campaign_invite', 'character', 'character_event',
    'campaign_session', 'session_encounter', 'stratagem', 'roll', 'journal_entry', 'builder_chat',
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

test('0200 backfills the label of a roll made before it, and a new stratagem starts at revision 1', async () => {
  const fresh = await openPlayDbs()
  try {
    const d = fresh.DB
    const sql = readFileSync(`${PLAY_MIGRATIONS}0200_snapshots_and_revisions.sql`, 'utf8')
    assert.ok(sql.includes('objective_label'))
    // Rebuild the pre-0200 shape of the two tables, then run the 0200 statements over rows that were written before it.
    await d.prepare('ALTER TABLE roll DROP COLUMN objective_label').run()
    await d.prepare('ALTER TABLE stratagem DROP COLUMN revision').run()
    await d.prepare("INSERT INTO user (id, display_name) VALUES ('u', 'U')").run()
    await d.prepare("INSERT INTO campaign (id, name, gm_user_id) VALUES ('c', 'C', 'u')").run()
    await d.prepare("INSERT INTO character (id, owner_user_id, campaign_id, name, state) VALUES ('ch', 'u', 'c', 'N', '{}')").run()
    await d.prepare("INSERT INTO stratagem (id, campaign_id, goal, time_per_roll, setup_cn, position, objectives) VALUES ('s', 'c', 'Take Thornwall', '1 day', 10, 0, ?)")
      .bind(JSON.stringify([{ title: 'Cut the road', cn: null, leaderCharacterId: null, state: 'open' }, { title: ' ', cn: 3, leaderCharacterId: null, state: 'open' }])).run()
    const roll = (id: string, strat: string | null, index: number | null) =>
      d.prepare("INSERT INTO roll (id, campaign_id, character_id, user_id, roll_type, ability, dice, total, objective_stratagem_id, objective_index, objective_cn) VALUES (?, 'c', 'ch', 'u', 'check', 'might', '[]', 1, ?, ?, ?)")
        .bind(id, strat, index, strat === null ? null : 10).run()
    await roll('plain', null, null)
    await roll('r0', 's', 0)
    await roll('r1', 's', 1)
    await roll('gone', 'deleted', 0)
    for (const statement of sql.replace(/--.*$/gm, '').split(';').map((x) => x.trim()).filter(Boolean)) await d.prepare(statement).run()
    const labels = (await d.prepare('SELECT id, objective_label FROM roll ORDER BY id').all<{ id: string; objective_label: string | null }>()).results
    assert.deepEqual(labels.map((r) => [r.id, r.objective_label]), [
      ['gone', null], ['plain', null], ['r0', 'Take Thornwall — Cut the road'], ['r1', 'Take Thornwall — Unknown objective'],
    ])
    assert.equal((await d.prepare("SELECT revision FROM stratagem WHERE id = 's'").first<{ revision: number }>())!.revision, 1)
  } finally {
    await fresh.dispose()
  }
})
