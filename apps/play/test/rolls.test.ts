import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ulid } from 'ulid'
import type { RandomDie } from '@heartrush/rules-engine/dice'
import type { BuilderInput } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../src/catalogue'
import { createDraft, finishDraft } from '../src/server/characters'
import type { LiveEvent } from '../src/server/live'
import {
  cryptoRand, listRolls, rerollDie, resolveComplication, rollForCharacter, ROLL_LIMIT,
  type RollOk, type RollRefusal,
} from '../src/server/rolls'
import { openPlayDbs, type D1 } from './db'

let t: Awaited<ReturnType<typeof openPlayDbs>>
let db: D1
before(async () => {
  t = await openPlayDbs()
  db = t.DB
})
after(() => t.dispose())

// Users: gm (the campaign's GM), owner (player, owns Ysolde), other (player, owns Bram), stranger (in no campaign).
// Ysolde and Bram are in campaign `camp`; Wanderer belongs to `owner` and is in no campaign.
let ysolde: string, bram: string, wanderer: string
beforeEach(async () => {
  await db.prepare('DELETE FROM campaign').run()
  await db.prepare('DELETE FROM character').run()
  await db.prepare('DELETE FROM user').run()
  for (const id of ['gm', 'owner', 'other', 'stranger']) await db.prepare('INSERT INTO user (id, display_name) VALUES (?, ?)').bind(id, `${id} the player`).run()
  await db.prepare('INSERT INTO campaign (id, name, gm_user_id) VALUES (?, ?, ?)').bind('camp', 'The Table', 'gm').run()
  for (const [user, role] of [['gm', 'gm'], ['owner', 'player'], ['other', 'player']]) {
    await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('camp', user, role).run()
  }
  ysolde = await finished('owner', 'camp', 'Ysolde')
  bram = await finished('other', 'camp', 'Bram')
  wanderer = await finished('owner', null, 'Wanderer')
})

const CENTAUR = [...getCatalogue().races.values()].find((r) => r.title === 'Centaur')!
const at = () => new Date().toISOString()
const builder = (name: string): BuilderInput => ({
  id: ulid(), at: at(), name, pronouns: '', dream: '', description: '', motivation: '', portrait: null,
  raceId: CENTAUR.id, subraceId: null, kinChoices: {},
  dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
  ageCategory: 'adult', ageBenefits: [], createdAspects: ['Loyal', 'Stubborn'],
  professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel: 1,
})
async function finished(owner: string, campaignId: string | null, name: string): Promise<string> {
  const draft = await createDraft(db, owner, { builder: builder(name) })
  assert.ok(draft.ok)
  const done = await finishDraft(db, owner, { characterId: draft.character.id, revision: draft.character.revision })
  assert.ok(done.ok)
  if (campaignId) await db.prepare('UPDATE character SET campaign_id = ? WHERE id = ?').bind(campaignId, done.character.id).run()
  return done.character.id
}

/** A random source that returns the queued values in order, then 4s. Each value must fit the die it is drawn for. */
const seq = (...values: number[]): RandomDie => {
  const queue = [...values]
  return (sides) => Math.min(queue.shift() ?? 4, sides)
}

/** Stands in for the CAMPAIGN_CHANNEL binding and records every published event. */
function fakeChannel() {
  const events: { campaign: string; event: LiveEvent }[] = []
  const env = {
    CAMPAIGN_CHANNEL: {
      idFromName: (name: string) => name,
      get: (name: string) => ({
        fetch: async (_: unknown, init: RequestInit) => {
          events.push({ campaign: name, event: JSON.parse(String(init.body)) })
          return new Response(null, { status: 204 })
        },
      }),
    },
  } as unknown as Parameters<typeof rollForCharacter>[1]
  return { env, events }
}

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r as Extract<T, { ok: true }>
}
function refused(r: { ok: boolean }, status: number, code: string) {
  assert.equal(r.ok, false, 'expected a refusal')
  assert.equal((r as RollRefusal).status, status)
  assert.equal((r as RollRefusal).code, code)
}
const check = (characterId: string, extra: Partial<Parameters<typeof rollForCharacter>[3]> = {}) =>
  ({ characterId, type: 'check' as const, ability: 'might' as const, modifier: 0, net: 0, ...extra })
const count = async (table: string) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n
const rollRow = async (id: string) => db.prepare('SELECT complication, total, dice FROM roll WHERE id = ?').bind(id).first<{ complication: string; total: number; dice: string }>()

// ---- spec criterion 14 ----------------------------------------------------------------------------

test('criterion 14: rolling changes no character state and creates no character_event', async () => {
  const before = await db.prepare('SELECT state, revision, updated_at FROM character WHERE id = ?').bind(ysolde).first()
  const events = await count('character_event')
  const { env } = fakeChannel()
  ok(await rollForCharacter(db, env, 'owner', check(ysolde, { modifier: 2 }), seq(5, 4)))
  assert.deepEqual(await db.prepare('SELECT state, revision, updated_at FROM character WHERE id = ?').bind(ysolde).first(), before)
  assert.equal(await count('character_event'), events)
})

test('the dice come from the stored character: Might d6, heart die, modifier +2, values 5 and 4 → total 11', async () => {
  const { env } = fakeChannel()
  const r = ok(await rollForCharacter(db, env, 'owner', check(ysolde, { modifier: 2 }), seq(5, 4)))
  assert.equal(r.result.total, 11)
  assert.equal(r.result.complication, 'none')
  assert.equal(r.roll!.total, 11)
  assert.deepEqual(r.roll!.dice.map((d) => d.role), ['heart', 'ability'])
  assert.equal(r.roll!.dice[1]!.sides, 6)
})

// ---- spec criterion 15 ----------------------------------------------------------------------------

test('criterion 15: a campaign roll stores one row and publishes one roll event; no campaign → no row and no publish', async () => {
  const { env, events } = fakeChannel()
  const r = ok(await rollForCharacter(db, env, 'owner', check(ysolde), seq(5, 4)))
  assert.equal(await count('roll'), 1)
  assert.equal(events.length, 1)
  assert.equal(events[0]!.campaign, 'camp')
  assert.equal(events[0]!.event.type, 'roll')
  assert.deepEqual((events[0]!.event as { roll: unknown }).roll, r.roll)
  assert.equal(r.roll!.characterName, 'Ysolde')
  assert.equal(r.roll!.playerName, 'owner the player')

  const solo = ok(await rollForCharacter(db, env, 'owner', check(wanderer), seq(5, 4)))
  assert.equal(solo.roll, null)
  assert.equal(solo.result.total, 9)
  assert.equal(await count('roll'), 1)
  assert.equal(events.length, 1)
})

test('only people who can edit the sheet roll: the owner and the GM; another player and a stranger get 403', async () => {
  const { env } = fakeChannel()
  ok(await rollForCharacter(db, env, 'gm', check(ysolde)))
  refused(await rollForCharacter(db, env, 'other', check(ysolde)), 403, 'forbidden')
  refused(await rollForCharacter(db, env, 'stranger', check(ysolde)), 403, 'forbidden')
  refused(await rollForCharacter(db, env, 'owner', check('nope')), 404, 'not_found')
  const stored = await db.prepare('SELECT user_id FROM roll').all<{ user_id: string }>()
  assert.deepEqual(stored.results.map((r) => r.user_id), ['gm'])
})

test('a draft cannot roll', async () => {
  const draft = await createDraft(db, 'owner', { builder: builder('Draft') })
  assert.ok(draft.ok)
  refused(await rollForCharacter(db, fakeChannel().env, 'owner', check(draft.character.id)), 409, 'is_draft')
})

test('bad input is refused before any roll: unknown ability, attack with Presence, huge net, fractional modifier', async () => {
  const { env, events } = fakeChannel()
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { ability: 'luck' as never })), 400, 'bad_roll')
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { type: 'attack', ability: 'presence' })), 400, 'bad_roll')
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { net: 1000 })), 400, 'bad_input')
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { modifier: 1.5 })), 400, 'bad_input')
  assert.equal(await count('roll'), 0)
  assert.equal(events.length, 0)
})

test('advantage rolls an extra die and drops the lowest', async () => {
  const { env } = fakeChannel()
  const r = ok(await rollForCharacter(db, env, 'owner', check(ysolde, { net: 1 }), seq(5, 4, 2)))
  assert.equal(r.roll!.dice.length, 3)
  assert.equal(r.roll!.dice.filter((d) => d.dropped).length, 1)
  assert.equal(r.roll!.total, 9)
})

// ---- spec criterion 16 ----------------------------------------------------------------------------

test('criterion 16: the 201st roll deletes the oldest and keeps the newest 200', async () => {
  const { env } = fakeChannel()
  const ids: string[] = []
  for (let i = 0; i < ROLL_LIMIT + 1; i++) ids.push(ok(await rollForCharacter(db, env, 'owner', check(ysolde), seq(5, 4))).roll!.id)
  assert.equal(await count('roll'), ROLL_LIMIT)
  assert.equal(await db.prepare('SELECT 1 AS x FROM roll WHERE id = ?').bind(ids[0]).first(), null)
  const listed = ok(await listRolls(db, 'other', { campaignId: 'camp' })).rolls
  assert.equal(listed.length, ROLL_LIMIT)
  assert.equal(listed[0]!.id, ids[ROLL_LIMIT])
  assert.equal(listed.at(-1)!.id, ids[1])
})

test('a campaign keeps its own 200: another campaign\'s rolls are not deleted', async () => {
  await db.prepare('INSERT INTO campaign (id, name, gm_user_id) VALUES (?, ?, ?)').bind('camp2', 'Other', 'gm').run()
  await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('camp2', 'gm', 'gm').run()
  const elsewhere = await finished('owner', 'camp2', 'Elsewhere')
  const { env } = fakeChannel()
  ok(await rollForCharacter(db, env, 'owner', check(elsewhere)))
  for (let i = 0; i < 3; i++) ok(await rollForCharacter(db, env, 'owner', check(ysolde)))
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM roll WHERE campaign_id = ?').bind('camp2').first<{ n: number }>())!.n, 1)
})

test('listRolls is for members only, newest first', async () => {
  const { env } = fakeChannel()
  const a = ok(await rollForCharacter(db, env, 'owner', check(ysolde))).roll!
  const b = ok(await rollForCharacter(db, env, 'other', check(bram))).roll!
  assert.deepEqual(ok(await listRolls(db, 'gm', { campaignId: 'camp' })).rolls.map((r) => r.id), [b.id, a.id])
  refused(await listRolls(db, 'stranger', { campaignId: 'camp' }), 403, 'forbidden')
})

// ---- spec criterion 7 (server half) and the objective roll -----------------------------------------

async function seedStratagem(leader: string | null, state = 'open') {
  const objectives = [{ title: 'Cut the supply road', cn: null, leaderCharacterId: leader, state }, { title: '', cn: 12, leaderCharacterId: null, state: 'open' }]
  const assets = [{ name: 'Scouts', kind: 'asset' }, { name: 'Rain', kind: 'hindrance' }, { name: 'Allies', kind: 'asset' }]
  await db
    .prepare('INSERT INTO stratagem (id, campaign_id, goal, time_per_roll, setup_cn, position, objectives, assets) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind('strat', 'camp', 'Take Thornwall', '1 week', 18, 0, JSON.stringify(objectives), JSON.stringify(assets))
    .run()
  return JSON.stringify(objectives)
}

test('criterion 7: the leader\'s objective roll is stored with the CN and label and changes nothing on the stratagem', async () => {
  const stored = await seedStratagem(ysolde)
  const { env, events } = fakeChannel()
  const r = ok(await rollForCharacter(db, env, 'owner', check(ysolde, { objective: { stratagemId: 'strat', index: 0 } }), seq(5, 4)))
  assert.deepEqual(r.roll!.objective, { stratagemId: 'strat', index: 0, cn: 15, label: 'Take Thornwall — Cut the supply road' })
  assert.equal(events.length, 1)
  const after = await db.prepare('SELECT objectives, assets, status FROM stratagem WHERE id = ?').bind('strat').first<{ objectives: string; status: string }>()
  assert.equal(after!.objectives, stored)
  assert.equal(after!.status, 'active')
  assert.equal(ok(await listRolls(db, 'other', { campaignId: 'camp' })).rolls[0]!.objective!.cn, 15)
  // Rolling again is another feed entry.
  ok(await rollForCharacter(db, env, 'owner', check(ysolde, { objective: { stratagemId: 'strat', index: 0 } })))
  assert.equal(await count('roll'), 2)
})

test('a saved objective roll keeps its label and CN when the stratagem is renamed, reordered, rewritten or deleted', async () => {
  await seedStratagem(ysolde)
  const { env } = fakeChannel()
  const rolled = ok(await rollForCharacter(db, env, 'owner', check(ysolde, { objective: { stratagemId: 'strat', index: 0 } }), seq(5, 4)))
  const expected = { stratagemId: 'strat', index: 0, cn: 15, label: 'Take Thornwall — Cut the supply road' }
  const feed = async () => ok(await listRolls(db, 'other', { campaignId: 'camp' })).rolls[0]!.objective
  assert.deepEqual(rolled.roll!.objective, expected)

  const second = JSON.stringify([{ title: 'Burn the granary', cn: 4, leaderCharacterId: null, state: 'open' }, { title: 'Cut the supply road', cn: null, leaderCharacterId: ysolde, state: 'open' }])
  await db.prepare("UPDATE stratagem SET goal = 'Take Ravenhold', setup_cn = 2, objectives = ? WHERE id = 'strat'").bind(second).run() // renamed, reordered, new CN
  assert.deepEqual(await feed(), expected)
  await db.prepare("UPDATE stratagem SET objectives = '[]' WHERE id = 'strat'").run() // objective deleted
  assert.deepEqual(await feed(), expected)
  await db.prepare("DELETE FROM stratagem WHERE id = 'strat'").run() // stratagem deleted
  assert.deepEqual(await feed(), expected)
})

test('criterion 7: a non-leader\'s objective roll is 403 and stores nothing — another player, the GM, a different character of the leader\'s player', async () => {
  await seedStratagem(ysolde)
  const { env, events } = fakeChannel()
  const objective = { stratagemId: 'strat', index: 0 }
  refused(await rollForCharacter(db, env, 'other', check(bram, { objective }), seq(5, 4)), 403, 'forbidden') // not the leader
  refused(await rollForCharacter(db, env, 'other', check(ysolde, { objective })), 403, 'forbidden') // not Ysolde's player
  refused(await rollForCharacter(db, env, 'gm', check(ysolde, { objective })), 403, 'forbidden') // the GM edits sheets but is not the player
  refused(await rollForCharacter(db, env, 'owner', check(wanderer, { objective })), 403, 'forbidden') // in no campaign
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { objective: { stratagemId: 'strat', index: 1 } })), 403, 'forbidden') // no leader
  assert.equal(await count('roll'), 0)
  assert.equal(events.length, 0)
})

test('an objective that is done or gone cannot be rolled; an unknown stratagem or index is refused', async () => {
  await seedStratagem(ysolde, 'done')
  const { env } = fakeChannel()
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { objective: { stratagemId: 'strat', index: 0 } })), 403, 'forbidden')
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { objective: { stratagemId: 'nope', index: 0 } })), 404, 'not_found')
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { objective: { stratagemId: 'strat', index: 9 } })), 400, 'bad_input')
  refused(await rollForCharacter(db, env, 'owner', { ...check(ysolde, { objective: { stratagemId: 'strat', index: 0 } }), type: 'save' }), 400, 'bad_input')
  assert.equal(await count('roll'), 0)
})

// ---- ruling 24: completion protocol --------------------------------------------------------------------

async function pendingRoll(env: Parameters<typeof rollForCharacter>[1], user = 'owner', characterId = ysolde): Promise<RollOk> {
  const r = ok(await rollForCharacter(db, env, user, check(characterId), seq(1, 4)))
  assert.equal(r.roll!.complication, 'pending')
  return r
}

test('ruling 24: one kept 1 is stored pending; the roller resolves it once with Fail, which keeps the dice and total', async () => {
  const { env, events } = fakeChannel()
  const r = await pendingRoll(env)
  assert.equal(r.result.complication, 'pending')
  const before = await rollRow(r.roll!.id)
  const done = ok(await resolveComplication(db, env, 'owner', r.roll!.id, 'fail'))
  assert.equal(done.roll.complication, 'failed')
  assert.equal(done.roll.total, 5)
  const after = await rollRow(r.roll!.id)
  assert.deepEqual({ ...after, complication: 'x' }, { ...before, complication: 'x' })
  assert.equal(after!.complication, 'failed')
  assert.equal(events.length, 2, 'the roll and its completion are both published')
  assert.deepEqual((events[1]!.event as { roll: unknown }).roll, done.roll)
  refused(await resolveComplication(db, env, 'owner', r.roll!.id, 'fail'), 409, 'already_resolved')
  refused(await resolveComplication(db, env, 'owner', r.roll!.id, 'reroll'), 409, 'already_resolved')
  assert.equal((await rollRow(r.roll!.id))!.complication, 'failed')
})

test('ruling 24: Reroll draws the replacement on the server, marks the roll rerolled and updates the total; a 1 on the reroll offers nothing further', async () => {
  const { env } = fakeChannel()
  const r = await pendingRoll(env)
  const done = ok(await resolveComplication(db, env, 'owner', r.roll!.id, 'reroll', seq(1)))
  assert.equal(done.roll.complication, 'rerolled')
  assert.equal(done.roll.total, 5)
  assert.equal(done.roll.dice.find((d) => d.rerolled !== undefined)!.rerolled, 1)
  refused(await resolveComplication(db, env, 'owner', r.roll!.id, 'reroll', seq(6)), 409, 'already_resolved')
  const again = await pendingRoll(env)
  assert.equal(ok(await resolveComplication(db, env, 'owner', again.roll!.id, 'reroll', seq(6))).roll.total, 10)
})

test('ruling 24: only the roller resolves — not the GM, not another member, not a stranger; the roll stays pending', async () => {
  const { env, events } = fakeChannel()
  const r = await pendingRoll(env)
  for (const user of ['gm', 'other', 'stranger']) refused(await resolveComplication(db, env, user, r.roll!.id, 'fail'), 403, 'forbidden')
  assert.equal((await rollRow(r.roll!.id))!.complication, 'pending')
  assert.equal(events.length, 1)
  refused(await resolveComplication(db, env, 'owner', 'nope', 'fail'), 404, 'not_found')
  refused(await resolveComplication(db, env, 'owner', r.roll!.id, 'bogus' as never), 400, 'bad_input')
  // A GM who rolled for the player's character is the roller of that roll.
  const gmRoll = await pendingRoll(env, 'gm')
  ok(await resolveComplication(db, env, 'gm', gmRoll.roll!.id, 'fail'))
})

test('ruling 24: two concurrent resolutions → exactly one wins', async () => {
  const { env } = fakeChannel()
  const r = await pendingRoll(env)
  const results = await Promise.all([
    resolveComplication(db, env, 'owner', r.roll!.id, 'fail'),
    resolveComplication(db, env, 'owner', r.roll!.id, 'reroll', seq(6)),
  ])
  assert.equal(results.filter((x) => x.ok).length, 1)
  assert.equal(results.filter((x) => !x.ok).length, 1)
})

test('ruling 24: two kept 1s are stored double (automatic failure, nothing to choose) and cannot be resolved', async () => {
  const { env } = fakeChannel()
  const r = ok(await rollForCharacter(db, env, 'owner', check(ysolde), seq(1, 1)))
  assert.equal(r.roll!.complication, 'double')
  assert.equal(r.result.complication, 'double')
  refused(await resolveComplication(db, env, 'owner', r.roll!.id, 'reroll'), 409, 'already_resolved')
  assert.equal((await rollRow(r.roll!.id))!.complication, 'double')
})

test('S12 and spec criterion 12: a dropped 1 and a saving throw never offer the choice', async () => {
  const { env } = fakeChannel()
  // heart 5, Might 4 → A1 adds a die of the lowest type (d6): [5, 1(dropped lowest? no)]. Values 5, 6, 1 → the 1 is dropped.
  const advantage = ok(await rollForCharacter(db, env, 'owner', check(ysolde, { net: 1 }), seq(5, 6, 1)))
  assert.equal(advantage.roll!.complication, 'none')
  const save = ok(await rollForCharacter(db, env, 'owner', { ...check(ysolde), type: 'save' }, seq(1, 4)))
  assert.equal(save.roll!.complication, 'none')
})

test('ruling 24: rerollDie for a character in no campaign returns one value for the die; refused for a campaign character, a non-editor and bad sides', async () => {
  assert.deepEqual(await rerollDie(db, 'owner', { characterId: wanderer, sides: 8 }, seq(7)), { ok: true, value: 7 })
  refused(await rerollDie(db, 'owner', { characterId: ysolde, sides: 8 }), 409, 'in_campaign')
  refused(await rerollDie(db, 'gm', { characterId: ysolde, sides: 8 }), 409, 'in_campaign')
  refused(await rerollDie(db, 'stranger', { characterId: wanderer, sides: 8 }), 403, 'forbidden')
  refused(await rerollDie(db, 'owner', { characterId: wanderer, sides: 3 }), 400, 'bad_input')
  refused(await rerollDie(db, 'owner', { characterId: wanderer, sides: 21 }), 400, 'bad_input')
  refused(await rerollDie(db, 'owner', { characterId: wanderer, sides: 8.5 }), 400, 'bad_input')
  refused(await rerollDie(db, 'owner', { characterId: 'nope', sides: 8 }), 404, 'not_found')
  assert.equal(await count('roll'), 0)
})

test('the crypto source stays within 1..sides and reaches both ends', () => {
  const seen = new Set<number>()
  for (let i = 0; i < 2000; i++) {
    const v = cryptoRand(4)
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 4)
    seen.add(v)
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4])
})

test('a stored roll cannot hold a value outside the five complication values (migration check)', async () => {
  const { env } = fakeChannel()
  const r = ok(await rollForCharacter(db, env, 'owner', check(ysolde)))
  await assert.rejects(db.prepare("UPDATE roll SET complication = 'bogus' WHERE id = ?").bind(r.roll!.id).run())
})

// ---- aspect invocation on a roll (aspect:invoke in the roll's batch) --------------------------------

type Stored = { play: { dp: number }; aspects: { id: string; text: string; rank: number; source: string; honor: boolean }[] }
const stored = async (id: string) => {
  const row = (await db.prepare('SELECT state, revision FROM character WHERE id = ?').bind(id).first<{ state: string; revision: number }>())!
  return { state: JSON.parse(row.state) as Stored, revision: row.revision }
}
async function editState(id: string, edit: (s: Stored) => void) {
  const { state } = await stored(id)
  edit(state)
  await db.prepare('UPDATE character SET state = ? WHERE id = ?').bind(JSON.stringify(state), id).run()
}
const loyal = async (id: string) => (await stored(id)).state.aspects.find((a) => a.text === 'Loyal')!
const invokeEvents = async (id: string) =>
  (await db.prepare('SELECT seq, action FROM character_event WHERE character_id = ? ORDER BY seq').bind(id).all<{ seq: number; action: string }>()).results
    .map((e) => ({ seq: e.seq, action: JSON.parse(e.action) as { kind: string; aspectId: string; dp: number } }))
    .filter((e) => e.action.kind === 'aspect:invoke')

test('a check invoking a rank-2 aspect spends 2 DP once, writes one aspect:invoke event and adds 2 to the stored roll', async () => {
  await editState(ysolde, (s) => { s.aspects.find((a) => a.text === 'Loyal')!.rank = 2 })
  const aspect = await loyal(ysolde)
  const before = await stored(ysolde)
  const { env, events } = fakeChannel()
  const r = ok(await rollForCharacter(db, env, 'owner', check(ysolde, { modifier: 1, aspect: { aspectId: aspect.id, dp: 2 } }), seq(5, 4)))
  assert.equal(r.result.total, 12)
  assert.equal(r.roll!.modifier, 3)
  const after = await stored(ysolde)
  assert.equal(after.state.play.dp, before.state.play.dp - 2)
  assert.equal(after.revision, before.revision + 1)
  assert.deepEqual(r.character, { revision: before.revision + 1, dp: before.state.play.dp - 2 })
  const invokes = await invokeEvents(ysolde)
  assert.equal(invokes.length, 1)
  assert.deepEqual([invokes[0]!.seq, invokes[0]!.action.aspectId, invokes[0]!.action.dp], [before.revision + 1, aspect.id, 2])
  assert.deepEqual(events.map((e) => e.event.type).sort(), ['character', 'roll'])
})

test('a character in no campaign spends the DP and stores no roll; a plain roll reports no character change', async () => {
  const aspect = await loyal(wanderer)
  const before = await stored(wanderer)
  const r = ok(await rollForCharacter(db, fakeChannel().env, 'owner', check(wanderer, { aspect: { aspectId: aspect.id, dp: 1 } }), seq(5, 4)))
  assert.equal(r.roll, null)
  assert.equal(r.result.total, 10)
  assert.equal((await stored(wanderer)).state.play.dp, before.state.play.dp - 1)
  assert.equal((await invokeEvents(wanderer)).length, 1)
  assert.equal(await count('roll'), 0)
  assert.equal(ok(await rollForCharacter(db, fakeChannel().env, 'owner', check(wanderer))).character, null)
})

test('an aspect roll is refused with nothing rolled, stored or spent: too little DP, over rank, Frail, unknown aspect, not a check', async () => {
  const aspect = await loyal(ysolde)
  const { env, events } = fakeChannel()
  await editState(ysolde, (s) => {
    s.play.dp = 0
    s.aspects.push({ id: 'frail', text: 'Frail', rank: 3, source: 'age', honor: false })
  })
  const before = await stored(ysolde)
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { aspect: { aspectId: aspect.id, dp: 1 } })), 409, 'not_enough_dp')
  await editState(ysolde, (s) => { s.play.dp = 5 })
  const rich = await stored(ysolde)
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { aspect: { aspectId: aspect.id, dp: 2 } })), 400, 'bad_input')
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { aspect: { aspectId: 'frail', dp: 3 } })), 400, 'bad_input')
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { aspect: { aspectId: 'nope', dp: 1 } })), 404, 'not_found')
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { type: 'save', aspect: { aspectId: aspect.id, dp: 1 } })), 400, 'bad_input')
  refused(await rollForCharacter(db, env, 'owner', check(ysolde, { aspect: { aspectId: aspect.id, dp: 0 } })), 400, 'bad_input')
  assert.equal(before.state.play.dp, 0)
  assert.deepEqual(await stored(ysolde), rich)
  assert.equal(await count('roll'), 0)
  assert.equal((await invokeEvents(ysolde)).length, 0)
  assert.equal(events.length, 0)
})

/** A D1 whose batch is preceded by another writer running `sql` (bound to the character id). */
const racingDb = (sql: string, id: string) =>
  new Proxy(db, {
    get(target, key) {
      if (key === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          await target.prepare(sql).bind(id).run()
          return target.batch(statements)
        }
      }
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

test('a sheet change landing between load and commit aborts the aspect roll: conflict, no roll row, no DP spent', async () => {
  const aspect = await loyal(ysolde)
  const before = await stored(ysolde)
  const racing = racingDb('UPDATE character SET revision = revision + 1 WHERE id = ?', ysolde)
  const { env, events } = fakeChannel()
  refused(await rollForCharacter(racing, env, 'owner', check(ysolde, { aspect: { aspectId: aspect.id, dp: 1 } }), seq(5, 4)), 409, 'conflict')
  const after = await stored(ysolde)
  assert.equal(after.state.play.dp, before.state.play.dp)
  assert.equal(after.revision, before.revision + 1)
  assert.equal(await count('roll'), 0)
  assert.equal((await invokeEvents(ysolde)).length, 0)
  assert.equal(events.length, 0)
})

test('leaving the campaign between load and commit aborts the aspect roll: conflict, no roll row, no DP spent', async () => {
  const aspect = await loyal(ysolde)
  const before = await stored(ysolde)
  // Leaving a campaign does not bump the revision; the campaign check alone must catch it.
  const racing = racingDb('UPDATE character SET campaign_id = NULL WHERE id = ?', ysolde)
  const { env, events } = fakeChannel()
  refused(await rollForCharacter(racing, env, 'owner', check(ysolde, { aspect: { aspectId: aspect.id, dp: 1 } }), seq(5, 4)), 409, 'conflict')
  const after = await stored(ysolde)
  assert.equal(after.state.play.dp, before.state.play.dp)
  assert.equal(after.revision, before.revision)
  assert.equal(await count('roll'), 0)
  assert.equal((await invokeEvents(ysolde)).length, 0)
  assert.equal(events.length, 0)
})
