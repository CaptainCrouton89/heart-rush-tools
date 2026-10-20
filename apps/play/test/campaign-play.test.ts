import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ulid } from 'ulid'
import type { BuilderInput } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../src/catalogue'
import { acceptInvite, assignCharacterToCampaign, awardXpToCampaign, createCampaign, createInvite } from '../src/server/campaigns'
import {
  attachEncounter, createStratagem, editRecap, endSession, listSessions, listStratagems, removeEncounter, setDay, startSession,
  updateStratagem, type CampaignPlayRefusal, type ObjectiveInput,
} from '../src/server/campaign-play'
import { createDraft, finishDraft } from '../src/server/characters'
import { createJournalEntry, setJournalShared } from '../src/server/journal'
import type { LiveEvent } from '../src/server/live'
import { rollForCharacter } from '../src/server/rolls'
import { openPlayDbs, type D1 } from './db'

let t: Awaited<ReturnType<typeof openPlayDbs>>
let db: D1
before(async () => {
  t = await openPlayDbs()
  db = t.DB
})
after(() => t.dispose())
beforeEach(async () => {
  await db.prepare('DELETE FROM campaign').run()
  await db.prepare('DELETE FROM character').run()
  await db.prepare('DELETE FROM user').run()
  for (const id of ['gm', 'alice', 'bob', 'stranger']) await db.prepare('INSERT INTO user (id, display_name) VALUES (?, ?)').bind(id, id).run()
})

const CENTAUR = [...getCatalogue().races.values()].find((r) => r.title === 'Centaur')!

function builder(name = 'Ysolde'): BuilderInput {
  return {
    id: ulid(), at: new Date().toISOString(), name, pronouns: 'she/her', dream: '', description: '', motivation: '', portrait: null,
    raceId: CENTAUR.id, subraceId: null, kinChoices: {},
    dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
    ageCategory: 'adult', ageBenefits: [], createdAspects: ['Loyal', 'Stubborn'],
    professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel: 0,
  }
}
function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r as Extract<T, { ok: true }>
}
function refused(r: { ok: boolean }, status: number, code: string): CampaignPlayRefusal {
  assert.equal(r.ok, false, 'expected a refusal')
  assert.equal((r as CampaignPlayRefusal).status, status)
  assert.equal((r as CampaignPlayRefusal).code, code)
  return r as CampaignPlayRefusal
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
  } as unknown as Parameters<typeof setDay>[1]
  return { env, events }
}

/** A campaign run by `gm` that `alice` and `bob` have joined, with a finished character each in it. */
async function table() {
  const { campaignId } = ok(await createCampaign(db, 'gm', { name: 'The Table' }))
  const { token } = ok(await createInvite(db, 'gm', { campaignId }))
  ok(await acceptInvite(db, 'alice', { token }))
  ok(await acceptInvite(db, 'bob', { token }))
  const characters: Record<string, string> = {}
  for (const owner of ['alice', 'bob']) {
    const b = builder(owner === 'alice' ? 'Ysolde' : 'Bran')
    ok(await createDraft(db, owner, { builder: b }))
    ok(await finishDraft(db, owner, { characterId: b.id, revision: 1 }))
    ok(await assignCharacterToCampaign(db, owner, { characterId: b.id, campaignId }))
    characters[owner] = b.id
  }
  return { campaignId, alice: characters.alice, bob: characters.bob }
}
const scalar = async <T>(sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).first<{ v: T }>())!.v
const characterSnapshot = async () => (await db.prepare('SELECT id, state, revision, updated_at FROM character ORDER BY id').all()).results
const count = (tbl: string) => scalar<number>(`SELECT COUNT(*) AS v FROM ${tbl}`)

// ---- Day (spec criteria 2, 3, 5) -----------------------------------------------------------------

test('criterion 2 (server half): a player\'s setDay is a 403 and the day is unchanged; a stranger is refused too', async () => {
  const { campaignId } = await table()
  const { env, events } = fakeChannel()
  refused(await setDay(db, env, 'alice', campaignId, { add: 1 }), 403, 'forbidden')
  refused(await setDay(db, env, 'alice', campaignId, { set: 40 }), 403, 'forbidden')
  refused(await setDay(db, env, 'stranger', campaignId, { add: 1 }), 403, 'forbidden')
  assert.equal(await scalar<number>('SELECT current_day AS v FROM campaign WHERE id = ?', campaignId), 1)
  assert.deepEqual(events, [])
})

test('criterion 3: the GM adds days, sets the day, and each write publishes one campaign event', async () => {
  const { campaignId } = await table()
  const { env, events } = fakeChannel()
  assert.equal(ok(await setDay(db, env, 'gm', campaignId, { add: 1 })).currentDay, 2)
  assert.equal(ok(await setDay(db, env, 'gm', campaignId, { add: 7 })).currentDay, 9)
  assert.equal(ok(await setDay(db, env, 'gm', campaignId, { set: 37 })).currentDay, 37)
  assert.equal(ok(await setDay(db, env, 'gm', campaignId, { set: 1 })).currentDay, 1)
  assert.deepEqual(events, Array(4).fill({ campaign: campaignId, event: { type: 'campaign' } }))
})

test('setDay refuses a day below 1, a fraction, a non-number, an add of 0 or less, and both or neither key', async () => {
  const { campaignId } = await table()
  const { env, events } = fakeChannel()
  for (const bad of [{ set: 0 }, { set: -3 }, { set: 2.5 }, { set: '9' }, { add: 0 }, { add: -1 }, { add: 1.5 }, { set: 5, add: 1 }, {}, { set: 2_000_000 }, { add: 2_000_000 }]) {
    refused(await setDay(db, env, 'gm', campaignId, bad as never), 400, 'bad_input')
  }
  assert.equal(await scalar<number>('SELECT current_day AS v FROM campaign WHERE id = ?', campaignId), 1)
  assert.deepEqual(events, [])
  refused(await setDay(db, env, 'gm', 'no-such-campaign', { add: 1 }), 403, 'forbidden')
})

test('criterion 5: a day change moves no character revision, state or event', async () => {
  const { campaignId } = await table()
  const { env } = fakeChannel()
  const before = await characterSnapshot()
  const events = await count('character_event')
  ok(await setDay(db, env, 'gm', campaignId, { add: 7 }))
  ok(await setDay(db, env, 'gm', campaignId, { set: 100 }))
  assert.deepEqual(await characterSnapshot(), before)
  assert.equal(await count('character_event'), events)
})

// ---- Sessions (spec criteria 2.2) ----------------------------------------------------------------

test('startSession: GM only; number = count + 1, start day = current_day, real date today; endSession sets the end day', async () => {
  const { campaignId } = await table()
  const { env, events } = fakeChannel()
  refused(await startSession(db, env, 'alice', campaignId), 403, 'forbidden')
  assert.equal(await count('campaign_session'), 0)

  ok(await setDay(db, env, 'gm', campaignId, { set: 12 }))
  const first = ok(await startSession(db, env, 'gm', campaignId)).session
  assert.equal(first.number, 1)
  assert.equal(first.startDay, 12)
  assert.equal(first.endDay, null)
  assert.equal(first.open, true)
  assert.equal(first.realDate, new Date().toISOString().slice(0, 10))

  refused(await endSession(db, env, 'alice', campaignId, { sessionId: first.id }), 403, 'forbidden')
  ok(await setDay(db, env, 'gm', campaignId, { add: 2 }))
  const ended = ok(await endSession(db, env, 'gm', campaignId, { sessionId: first.id })).session
  assert.equal(ended.endDay, 14)
  assert.equal(ended.open, false)
  assert.equal(refused(await endSession(db, env, 'gm', campaignId, { sessionId: first.id }), 409, 'session_closed').message, 'Session 1 has already ended')

  const second = ok(await startSession(db, env, 'gm', campaignId)).session
  assert.equal(second.number, 2)
  assert.equal(second.startDay, 14)
  assert.equal(events.length, 5)
})

test('startSession is refused while one is open, naming it: "End session N first"; two starts racing give one session', async () => {
  const { campaignId } = await table()
  const { env } = fakeChannel()
  const first = ok(await startSession(db, env, 'gm', campaignId)).session
  assert.equal(refused(await startSession(db, env, 'gm', campaignId), 409, 'session_open').message, 'End session 1 first')
  ok(await endSession(db, env, 'gm', campaignId, { sessionId: first.id }))
  const [a, b] = await Promise.all([startSession(db, env, 'gm', campaignId), startSession(db, env, 'gm', campaignId)])
  assert.equal([a, b].filter((r) => r.ok).length, 1, JSON.stringify([a, b]))
  assert.equal([a, b].filter((r) => !r.ok && r.message === 'End session 2 first').length, 1, JSON.stringify([a, b]))
  assert.equal(await count('campaign_session'), 2)
})

test('startSession takes a calendar date and refuses nonsense; an unknown key is refused', async () => {
  const { campaignId } = await table()
  const { env } = fakeChannel()
  refused(await startSession(db, env, 'gm', campaignId, { realDate: '2026-13-40' }), 400, 'bad_input')
  refused(await startSession(db, env, 'gm', campaignId, { realDate: 'today' }), 400, 'bad_input')
  refused(await startSession(db, env, 'gm', campaignId, { date: '2026-10-20' } as never), 400, 'bad_input')
  assert.equal(ok(await startSession(db, env, 'gm', campaignId, { realDate: '2026-10-20' })).session.realDate, '2026-10-20')
})

test('sessions belong to their campaign: another campaign\'s GM cannot end, recap or attach to them', async () => {
  const { campaignId } = await table()
  const { campaignId: other } = ok(await createCampaign(db, 'alice', { name: 'Elsewhere' }))
  const { env } = fakeChannel()
  const session = ok(await startSession(db, env, 'gm', campaignId)).session
  refused(await endSession(db, env, 'alice', other, { sessionId: session.id }), 404, 'not_found')
  refused(await editRecap(db, env, 'alice', other, { sessionId: session.id, recap: 'x' }), 404, 'not_found')
  refused(await attachEncounter(db, env, 'alice', other, session.id, { encounterId: 'e1', title: 'E' }), 404, 'not_found')
  assert.equal(await scalar<number | null>('SELECT end_day AS v FROM campaign_session WHERE id = ?', session.id), null)
  assert.equal(await count('session_encounter'), 0)
})

test('editRecap: GM only, any session open or closed; listSessions returns newest first with the recap', async () => {
  const { campaignId } = await table()
  const { env, events } = fakeChannel()
  const one = ok(await startSession(db, env, 'gm', campaignId)).session
  ok(await endSession(db, env, 'gm', campaignId, { sessionId: one.id }))
  const two = ok(await startSession(db, env, 'gm', campaignId)).session
  refused(await editRecap(db, env, 'bob', campaignId, { sessionId: two.id, recap: 'mine' }), 403, 'forbidden')
  ok(await editRecap(db, env, 'gm', campaignId, { sessionId: one.id, recap: '# The siege\n\nThey won.' }))
  ok(await editRecap(db, env, 'gm', campaignId, { sessionId: two.id, recap: 'In progress' }))
  refused(await editRecap(db, env, 'gm', campaignId, { sessionId: 'nope', recap: 'x' }), 404, 'not_found')
  refused(await editRecap(db, env, 'gm', campaignId, { sessionId: two.id, recap: 5 as never }), 400, 'bad_input')
  refused(await editRecap(db, env, 'gm', campaignId, { sessionId: two.id, recap: 'x'.repeat(20001) }), 400, 'bad_input')

  const list = ok(await listSessions(db, 'bob', campaignId))
  assert.deepEqual(list.sessions.map((s) => [s.number, s.recap, s.open]), [[2, 'In progress', true], [1, '# The siege\n\nThey won.', false]])
  assert.equal(events.filter((e) => e.event.type === 'campaign').length, 5) // start, end, start, two recaps
})

test('listSessions is for members only', async () => {
  const { campaignId } = await table()
  refused(await listSessions(db, 'stranger', campaignId), 403, 'forbidden')
  refused(await listSessions(db, 'alice', ''), 400, 'bad_input')
  assert.deepEqual(ok(await listSessions(db, 'alice', campaignId)), { ok: true, sessions: [], betweenSessions: [] })
})

test('listSessions: XP awarded while a session is open is listed on it, and shared journal entries group by session and "Between sessions"', async () => {
  const { campaignId, alice, bob } = await table()
  const { env } = fakeChannel()

  // Written and shared with no session open → Between sessions.
  const between = ok(await createJournalEntry(db, 'alice', { characterId: alice, body: 'Before anything\nsecond line' })).entry
  ok(await setJournalShared(db, 'alice', { entryId: between.id, shared: true }))

  const session = ok(await startSession(db, env, 'gm', campaignId)).session
  const during = ok(await createJournalEntry(db, 'bob', { characterId: bob, body: 'We marched' })).entry
  ok(await setJournalShared(db, 'bob', { entryId: during.id, shared: true }))
  ok(await createJournalEntry(db, 'bob', { characterId: bob, body: 'My private worry' })) // never shared
  ok(await awardXpToCampaign(db, 'gm', { campaignId, amount: 3 }))

  const list = ok(await listSessions(db, 'alice', campaignId))
  assert.equal(list.sessions.length, 1)
  const s = list.sessions[0]
  assert.equal(s.id, session.id)
  assert.deepEqual(s.xpAwards.map((a) => a.amount), [3])
  assert.deepEqual(s.journal.map((j) => [j.characterName, j.body]), [['Bran', 'We marched']])
  assert.deepEqual(list.betweenSessions.map((j) => [j.characterName, j.body]), [['Ysolde', 'Before anything\nsecond line']])
  const everything = JSON.stringify(list)
  assert.ok(!everything.includes('My private worry'), 'an unshared entry never reaches the session log')
})

// ---- Encounters (spec §7.3) ----------------------------------------------------------------------

test('attachEncounter stores one session_encounter row that listSessions returns with the tools URL; removeEncounter deletes it', async () => {
  const { campaignId } = await table()
  const { env, events } = fakeChannel()
  const session = ok(await startSession(db, env, 'gm', campaignId)).session
  const attached = ok(await attachEncounter(db, env, 'gm', campaignId, session.id, { encounterId: 'enc_1', title: '  Ambush at the ford  ' })).encounter
  assert.equal(attached.title, 'Ambush at the ford')
  assert.equal(attached.url, 'https://tools.heartrush.party/encounter-builder/enc_1')
  assert.equal(await count('session_encounter'), 1)

  const seenByPlayer = ok(await listSessions(db, 'bob', campaignId)).sessions[0]
  assert.deepEqual(seenByPlayer.encounters.map((e) => [e.encounterId, e.title, e.url]), [['enc_1', 'Ambush at the ford', 'https://tools.heartrush.party/encounter-builder/enc_1']])

  // The same encounter again is a rename, not a second row.
  ok(await attachEncounter(db, env, 'gm', campaignId, session.id, { encounterId: 'enc_1', title: 'Ambush' }))
  assert.equal(await count('session_encounter'), 1)
  assert.equal(ok(await listSessions(db, 'gm', campaignId)).sessions[0].encounters[0].title, 'Ambush')

  refused(await removeEncounter(db, env, 'bob', campaignId, session.id, { encounterId: 'enc_1' }), 403, 'forbidden')
  assert.equal(await count('session_encounter'), 1)
  const before = events.length
  ok(await removeEncounter(db, env, 'gm', campaignId, session.id, { encounterId: 'enc_1' }))
  assert.equal(await count('session_encounter'), 0)
  assert.equal(events.length, before + 1)
  refused(await removeEncounter(db, env, 'gm', campaignId, session.id, { encounterId: 'enc_1' }), 404, 'not_found')
})

test('attachEncounter: GM only (a player is 403, nothing stored, nothing published); attaches to a closed session; validates its input', async () => {
  const { campaignId } = await table()
  const { env, events } = fakeChannel()
  const session = ok(await startSession(db, env, 'gm', campaignId)).session
  const published = events.length
  refused(await attachEncounter(db, env, 'alice', campaignId, session.id, { encounterId: 'e', title: 'T' }), 403, 'forbidden')
  refused(await attachEncounter(db, env, 'stranger', campaignId, session.id, { encounterId: 'e', title: 'T' }), 403, 'forbidden')
  assert.equal(await count('session_encounter'), 0)
  assert.equal(events.length, published)

  refused(await attachEncounter(db, env, 'gm', campaignId, session.id, { encounterId: 'e', title: '   ' }), 400, 'bad_input')
  refused(await attachEncounter(db, env, 'gm', campaignId, session.id, { encounterId: '', title: 'T' }), 400, 'bad_input')
  refused(await attachEncounter(db, env, 'gm', campaignId, 'no-such-session', { encounterId: 'e', title: 'T' }), 404, 'not_found')

  ok(await endSession(db, env, 'gm', campaignId, { sessionId: session.id }))
  ok(await attachEncounter(db, env, 'gm', campaignId, session.id, { encounterId: 'e', title: 'T' }))
  assert.equal(await count('session_encounter'), 1)
})

// ---- Stratagems (spec criteria 6, 8) -------------------------------------------------------------

const objective = (over: Partial<ObjectiveInput> = {}): ObjectiveInput => ({ title: 'Cut the supply road', cn: null, leaderCharacterId: null, state: 'open', ...over })

test('criterion 6: an open objective\'s CN is 15 with no asset, 12 with one asset, 9 with two, through listStratagems', async () => {
  const { campaignId } = await table()
  const { env } = fakeChannel()
  const made = ok(await createStratagem(db, env, 'gm', campaignId, { goal: 'Take Thornwall', timePerRoll: '1 week', setupCn: 15, objectives: [objective()] })).stratagem
  const cnOf = async () => ok(await listStratagems(db, 'alice', campaignId)).stratagems[0].objectives[0].currentCn

  assert.equal(await cnOf(), 15)
  ok(await updateStratagem(db, env, 'gm', campaignId, { stratagemId: made.id, assets: [{ name: 'Sapper tunnel', kind: 'asset' }] }))
  assert.equal(await cnOf(), 12)
  ok(await updateStratagem(db, env, 'gm', campaignId, { stratagemId: made.id, assets: [{ name: 'Sapper tunnel', kind: 'asset' }, { name: 'Spies inside', kind: 'asset' }] }))
  assert.equal(await cnOf(), 9)
})

test('objective CN: a hindrance adds 3, an own CN replaces the setup CN, done and gone objectives have none, and there is no floor', async () => {
  const { campaignId } = await table()
  const { env } = fakeChannel()
  const made = ok(
    await createStratagem(db, env, 'gm', campaignId, {
      goal: 'Raid', timePerRoll: '1 day', setupCn: 10,
      objectives: [objective({ title: 'A' }), objective({ title: '', cn: 18 }), objective({ title: 'C', state: 'done' }), objective({ title: 'D', state: 'gone' })],
      assets: [{ name: 'Rain', kind: 'hindrance' }, { name: 'Guides', kind: 'asset' }, { name: 'Map', kind: 'asset' }, { name: 'Scouts', kind: 'asset' }, { name: 'Bribe', kind: 'asset' }],
    }),
  ).stratagem
  // net −9 (four assets, one hindrance): 10 → 1, 18 → 9
  assert.deepEqual(made.objectives.map((o) => o.currentCn), [1, 9, null, null])
  ok(await updateStratagem(db, env, 'gm', campaignId, { stratagemId: made.id, setupCn: 2 }))
  assert.equal(ok(await listStratagems(db, 'bob', campaignId)).stratagems[0].objectives[0].currentCn, -7)
})

test('the stored objective JSON carries leaderCharacterId, the key the roll server reads for an objective roll', async () => {
  const { campaignId, alice } = await table()
  const { env } = fakeChannel()
  const made = ok(await createStratagem(db, env, 'gm', campaignId, { goal: 'Take Thornwall', timePerRoll: '1 week', setupCn: 15, objectives: [objective({ leaderCharacterId: alice })] })).stratagem
  const stored = JSON.parse(await scalar<string>('SELECT objectives AS v FROM stratagem WHERE id = ?', made.id))
  assert.deepEqual(stored, [{ title: 'Cut the supply road', cn: null, leaderCharacterId: alice, state: 'open' }])
  assert.equal(made.objectives[0].leaderName, 'Ysolde')

  // Round trip through RS: the leader rolls the objective and the stored roll carries the current CN.
  const rolled = ok(await rollForCharacter(db, env, 'alice', { characterId: alice, type: 'check', ability: 'might', modifier: 0, net: 0, objective: { stratagemId: made.id, index: 0 } }))
  assert.equal(rolled.roll?.objective?.cn, 15)
})

test('criterion 8: a player\'s updateStratagem (any field) and createStratagem are 403 and change nothing', async () => {
  const { campaignId } = await table()
  const { env, events } = fakeChannel()
  const made = ok(await createStratagem(db, env, 'gm', campaignId, { goal: 'Take Thornwall', timePerRoll: '1 week', setupCn: 15, objectives: [objective()] })).stratagem
  const published = events.length
  const before = (await db.prepare('SELECT * FROM stratagem').all()).results
  for (const patch of [
    { goal: 'Mine now' }, { timePerRoll: '1 day' }, { setupCn: 3 }, { objectives: [] }, { assets: [{ name: 'x', kind: 'asset' as const }] },
    { status: 'finished' as const }, { position: 9 },
  ]) {
    refused(await updateStratagem(db, env, 'alice', campaignId, { stratagemId: made.id, ...patch }), 403, 'forbidden')
  }
  refused(await updateStratagem(db, env, 'stranger', campaignId, { stratagemId: made.id, goal: 'x' }), 403, 'forbidden')
  refused(await createStratagem(db, env, 'alice', campaignId, { goal: 'Mine', timePerRoll: 'x', setupCn: 1 }), 403, 'forbidden')
  assert.deepEqual((await db.prepare('SELECT * FROM stratagem').all()).results, before)
  assert.equal(events.length, published)
  refused(await listStratagems(db, 'stranger', campaignId), 403, 'forbidden')
})

test('createStratagem appends by position; updateStratagem changes only the keys given and a position reorders the list', async () => {
  const { campaignId } = await table()
  const { env, events } = fakeChannel()
  const a = ok(await createStratagem(db, env, 'gm', campaignId, { goal: 'A', timePerRoll: '1 week', setupCn: 12 })).stratagem
  const b = ok(await createStratagem(db, env, 'gm', campaignId, { goal: 'B', timePerRoll: '1 day', setupCn: 14 })).stratagem
  assert.deepEqual([a.position, b.position, a.status], [0, 1, 'active'])

  const renamed = ok(await updateStratagem(db, env, 'gm', campaignId, { stratagemId: b.id, goal: 'B2', status: 'finished', position: -0 })).stratagem
  assert.deepEqual([renamed.goal, renamed.timePerRoll, renamed.setupCn, renamed.status], ['B2', '1 day', 14, 'finished'])
  ok(await updateStratagem(db, env, 'gm', campaignId, { stratagemId: a.id, position: 5 }))
  assert.deepEqual(ok(await listStratagems(db, 'bob', campaignId)).stratagems.map((s) => s.goal), ['B2', 'A'])
  assert.equal(events.length, 4)
})

test('stratagem input is validated: leader must be in the campaign, unknown keys and bad values refused, other campaigns\' stratagems are 404', async () => {
  const { campaignId, alice } = await table()
  const { campaignId: other } = ok(await createCampaign(db, 'alice', { name: 'Elsewhere' }))
  const { env } = fakeChannel()
  const base = { goal: 'G', timePerRoll: 't', setupCn: 10 }
  refused(await createStratagem(db, env, 'gm', campaignId, { ...base, objectives: [objective({ leaderCharacterId: 'not-a-character' })] }), 400, 'bad_input')
  refused(await createStratagem(db, env, 'gm', campaignId, { goal: 'G', timePerRoll: 't' } as never), 400, 'bad_input')
  refused(await createStratagem(db, env, 'gm', campaignId, { ...base, setupCn: 1.5 }), 400, 'bad_input')
  refused(await createStratagem(db, env, 'gm', campaignId, { ...base, goal: '  ' }), 400, 'bad_input')
  refused(await createStratagem(db, env, 'gm', campaignId, { ...base, status: 'won' as never }), 400, 'bad_input')
  refused(await createStratagem(db, env, 'gm', campaignId, { ...base, party: 1 } as never), 400, 'bad_input')
  refused(await createStratagem(db, env, 'gm', campaignId, { ...base, objectives: [{ ...objective(), leader: alice } as never] }), 400, 'bad_input')
  refused(await createStratagem(db, env, 'gm', campaignId, { ...base, objectives: [objective({ state: 'won' as never })] }), 400, 'bad_input')
  refused(await createStratagem(db, env, 'gm', campaignId, { ...base, assets: [{ name: 'x', kind: 'boon' as never }] }), 400, 'bad_input')
  assert.equal(await count('stratagem'), 0)

  const made = ok(await createStratagem(db, env, 'gm', campaignId, base)).stratagem
  refused(await updateStratagem(db, env, 'gm', campaignId, { stratagemId: made.id }), 400, 'bad_input')
  refused(await updateStratagem(db, env, 'alice', other, { stratagemId: made.id, goal: 'Mine' }), 404, 'not_found')
  assert.equal(await scalar<string>('SELECT goal AS v FROM stratagem WHERE id = ?', made.id), 'G')
  ok(await updateStratagem(db, env, 'gm', campaignId, { stratagemId: made.id, objectives: [objective({ title: '', leaderCharacterId: alice })] }))
  assert.equal(ok(await listStratagems(db, 'gm', campaignId)).stratagems[0].objectives[0].title, '')
})
