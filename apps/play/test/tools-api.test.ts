import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ulid } from 'ulid'
import type { BuilderInput, ClientAction } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../src/catalogue'
import { acceptInvite, assignCharacterToCampaign, createCampaign, createInvite } from '../src/server/campaigns'
import { listSessions as listSessionViews, startSession } from '../src/server/campaign-play'
import { applyCharacterAction, createDraft, finishDraft, getCharacter } from '../src/server/characters'
import type { LiveEvent } from '../src/server/live'
import { attachEncounter, getCampaignForEncounter, listGmCampaigns, listSessions } from '../src/server/tools-api'
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
  for (const id of ['gm', 'gm2', 'alice', 'stranger']) await db.prepare('INSERT INTO user (id, display_name) VALUES (?, ?)').bind(id, id).run()
})

const cat = getCatalogue()
const CENTAUR = [...cat.races.values()].find((r) => r.title === 'Centaur')!
const COMBAT = [...cat.talents.values()].find((x) => x.category === 'combat')!

const at = () => new Date().toISOString()
function builder(name: string, bloodmarkLevel: number): BuilderInput {
  return {
    id: ulid(), at: at(), name, pronouns: 'she/her', dream: '', description: '', motivation: '', portrait: null,
    raceId: CENTAUR.id, subraceId: null, kinChoices: {},
    dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
    ageCategory: 'adult', ageBenefits: [], createdAspects: ['Loyal', 'Stubborn'],
    professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel,
  }
}
function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r as Extract<T, { ok: true }>
}
const rejects = (p: Promise<unknown>, message: string) => assert.rejects(p, (e: Error) => e.message === message)

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
  } as unknown as Parameters<typeof attachEncounter>[1]
  return { env, events }
}

/** A campaign `gm` runs and `alice` plays in, with her finished character in it. */
async function table() {
  const { campaignId } = ok(await createCampaign(db, 'gm', { name: 'The Table' }))
  const { token } = ok(await createInvite(db, 'gm', { campaignId }))
  ok(await acceptInvite(db, 'alice', { token }))
  const b = builder('Ysolde', 2)
  ok(await createDraft(db, 'alice', { builder: b }))
  ok(await finishDraft(db, 'alice', { characterId: b.id, revision: 1 }))
  ok(await assignCharacterToCampaign(db, 'alice', { characterId: b.id, campaignId }))
  return { campaignId, characterId: b.id }
}
const act = async (characterId: string, action: ClientAction) => {
  const cur = ok(await getCharacter(db, 'alice', { characterId })).character
  return ok(await applyCharacterAction(db, 'alice', { characterId, revision: cur.revision, action }))
}

test('listGmCampaigns: a GM sees only the campaigns they run, not ones they play in or others run', async () => {
  const { campaignId } = await table()
  const other = ok(await createCampaign(db, 'gm2', { name: 'Elsewhere' })).campaignId
  const { token } = ok(await createInvite(db, 'gm2', { campaignId: other }))
  ok(await acceptInvite(db, 'gm', { token })) // gm is a player in gm2's campaign
  assert.deepEqual(await listGmCampaigns(db, 'gm'), [{ id: campaignId, name: 'The Table' }])
  assert.deepEqual(await listGmCampaigns(db, 'gm2'), [{ id: other, name: 'Elsewhere' }])
  assert.deepEqual(await listGmCampaigns(db, 'alice'), [])
  assert.deepEqual(await listGmCampaigns(db, 'stranger'), [])
})

test('every method refuses a player, a stranger and a missing user with forbidden, and an unknown campaign with not_found', async () => {
  const { campaignId } = await table()
  const { env } = fakeChannel()
  const encounter = { encounterId: 'e1', title: 'Ambush' }
  for (const user of ['alice', 'stranger', 'gm2']) {
    await rejects(getCampaignForEncounter(db, user, campaignId), 'forbidden')
    await rejects(listSessions(db, user, campaignId), 'forbidden')
    await rejects(attachEncounter(db, env, user, campaignId, 'whatever', encounter), 'forbidden')
  }
  await rejects(listGmCampaigns(db, '' as string), 'forbidden')
  await rejects(getCampaignForEncounter(db, undefined as unknown as string, campaignId), 'forbidden')
  await rejects(getCampaignForEncounter(db, 'gm', 'no-such-campaign'), 'not_found')
  await rejects(listSessions(db, 'gm', 'no-such-campaign'), 'not_found')
  await rejects(attachEncounter(db, env, 'gm', 'no-such-campaign', 's', encounter), 'not_found')
})

test('getCampaignForEncounter: the numbers are the rules engine\'s for a seeded character', async () => {
  const { campaignId, characterId } = await table()
  await act(characterId, { id: ulid(), at: at(), kind: 'xp:award', amount: 10 })
  await act(characterId, {
    id: ulid(), at: at(), kind: 'xp:buy', purchase: 'talent:combat',
    talent: { catalogueId: COMBAT.id },
  })
  await act(characterId, {
    id: ulid(), at: at(), kind: 'gear:weapon:add',
    weapon: { name: 'Pike', size: 'H', damageType: 'P', attackType: 'might', reach: true, misc: 0, wielded: false },
  } as ClientAction)
  const withWeapon = ok(await getCharacter(db, 'alice', { characterId })).character
  assert.ok(!withWeapon.state.draft)
  await act(characterId, { id: ulid(), at: at(), kind: 'gear:wield', weaponId: withWeapon.state.gear.weapons[0].id })
  await act(characterId, { id: ulid(), at: at(), kind: 'wound:add', wound: { rank: 12, description: 'Gored' } })

  const doc = ok(await getCharacter(db, 'alice', { characterId })).character
  assert.ok(!doc.state.draft && doc.derived)
  assert.ok(doc.derived.effectiveMaxHp < doc.derived.maxHp, 'the wound lowers effective max HP')
  const result = await getCampaignForEncounter(db, 'gm', campaignId)
  assert.deepEqual(result, {
    name: 'The Table',
    characters: [{
      name: 'Ysolde',
      bloodmarks: 2,
      maxHp: doc.derived.maxHp,
      effectiveMaxHp: doc.derived.effectiveMaxHp,
      maxHeartDie: doc.derived.maxHeartDie,
      wielded: { size: 'H', damageType: 'P' },
      talents: doc.state.talents.map((x) => x.titleSnapshot),
    }],
  })
  assert.ok(result.characters[0].talents.includes(COMBAT.title))
})

test('getCampaignForEncounter: no wielded weapon is null; drafts and characters of other campaigns are left out', async () => {
  const { campaignId } = await table()
  const draft = builder('Unfinished', 0)
  ok(await createDraft(db, 'gm', { builder: draft }))
  const elsewhere = ok(await createCampaign(db, 'gm2', { name: 'Elsewhere' })).campaignId
  const result = await getCampaignForEncounter(db, 'gm', campaignId)
  assert.deepEqual(result.characters.map((c) => [c.name, c.wielded]), [['Ysolde', null]])
  assert.deepEqual((await getCampaignForEncounter(db, 'gm2', elsewhere)).characters, [])
})

test('listSessions: {id, number, open}, newest first, open flag follows the session', async () => {
  const { campaignId } = await table()
  const { env } = fakeChannel()
  assert.deepEqual(await listSessions(db, 'gm', campaignId), [])
  const first = ok(await startSession(db, env, 'gm', campaignId, {}))
  const [only] = await listSessions(db, 'gm', campaignId)
  assert.deepEqual(only, { id: first.session.id, number: 1, open: true })
  await db.prepare('UPDATE campaign_session SET end_day = start_day WHERE id = ?').bind(first.session.id).run()
  const second = ok(await startSession(db, env, 'gm', campaignId, {}))
  assert.deepEqual(await listSessions(db, 'gm', campaignId), [
    { id: second.session.id, number: 2, open: true },
    { id: first.session.id, number: 1, open: false },
  ])
})

test('attachEncounter: one attachment, the derived tools URL on the session read, a campaign event published', async () => {
  const { campaignId } = await table()
  const { env, events } = fakeChannel()
  const sessionId = ok(await startSession(db, env, 'gm', campaignId, {})).session.id
  events.length = 0
  assert.equal(await attachEncounter(db, env, 'gm', campaignId, sessionId, { encounterId: 'enc-123', title: 'Bridge Ambush' }), undefined)
  const sessions = ok(await listSessionViews(db, 'alice', campaignId)).sessions
  assert.equal(sessions[0].encounters.length, 1)
  assert.equal(sessions[0].encounters[0].title, 'Bridge Ambush')
  assert.equal(sessions[0].encounters[0].url, 'https://tools.heartrush.party/encounter-builder/enc-123')
  assert.deepEqual(events, [{ campaign: campaignId, event: { type: 'campaign' } }])
  // Attaching again renames, never duplicates.
  await attachEncounter(db, env, 'gm', campaignId, sessionId, { encounterId: 'enc-123', title: 'Bridge Ambush II' })
  const again = ok(await listSessionViews(db, 'alice', campaignId)).sessions[0].encounters
  assert.deepEqual(again.map((e) => e.title), ['Bridge Ambush II'])
})

test('attachEncounter: a session of another campaign is not_found, a blank title is bad_input, and nothing is stored', async () => {
  const { campaignId } = await table()
  const { env } = fakeChannel()
  const elsewhere = ok(await createCampaign(db, 'gm2', { name: 'Elsewhere' })).campaignId
  const foreign = ok(await startSession(db, env, 'gm2', elsewhere, {})).session.id
  const sessionId = ok(await startSession(db, env, 'gm', campaignId, {})).session.id
  await rejects(attachEncounter(db, env, 'gm', campaignId, foreign, { encounterId: 'e', title: 'T' }), 'not_found')
  await rejects(attachEncounter(db, env, 'gm', campaignId, 'missing', { encounterId: 'e', title: 'T' }), 'not_found')
  await assert.rejects(attachEncounter(db, env, 'gm', campaignId, sessionId, { encounterId: 'e', title: '  ' }), /^Error: bad_input: /)
  assert.equal((await db.prepare('SELECT COUNT(*) AS v FROM session_encounter').first<{ v: number }>())!.v, 0)
})
