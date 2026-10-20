import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ulid } from 'ulid'
import type { BuilderInput, ClientAction } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../src/catalogue'
import {
  acceptInvite, assignCharacterToCampaign, awardXpToCampaign, createCampaign, createInvite, getCampaign, listMyCampaigns,
  publishAward, publishCampaignChange, removeCharacterFromCampaign, type CampaignRefusal,
} from '../src/server/campaigns'
import { applyCharacterAction, createDraft, finishDraft, getCharacter, type CharacterDoc } from '../src/server/characters'
import type { LiveEvent } from '../src/server/live'
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
  for (const id of ['gm', 'alice', 'bob', 'carol', 'stranger']) await db.prepare('INSERT INTO user (id, display_name) VALUES (?, ?)').bind(id, id).run()
})

const CENTAUR = [...getCatalogue().races.values()].find((r) => r.title === 'Centaur')!
const CRAVEN = [...getCatalogue().races.values()].find((r) => r.title === 'Craven')

const at = () => new Date().toISOString()
function builder(overrides: Partial<BuilderInput> = {}): BuilderInput {
  return {
    id: ulid(), at: at(), name: 'Ysolde', pronouns: 'she/her', dream: '', description: '', motivation: '', portrait: null,
    raceId: CENTAUR.id, subraceId: null, kinChoices: {},
    dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
    ageCategory: 'adult', ageBenefits: [], createdAspects: ['Loyal', 'Stubborn'],
    professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel: 0,
    ...overrides,
  }
}
function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r as Extract<T, { ok: true }>
}
function refused(r: { ok: boolean }, status: number, code: string): CampaignRefusal {
  assert.equal(r.ok, false, 'expected a refusal')
  assert.equal((r as CampaignRefusal).status, status)
  assert.equal((r as CampaignRefusal).code, code)
  return r as CampaignRefusal
}
const finishedCharacter = async (owner: string, overrides: Partial<BuilderInput> = {}): Promise<CharacterDoc> => {
  const b = builder(overrides)
  ok(await createDraft(db, owner, { builder: b }))
  return ok(await finishDraft(db, owner, { characterId: b.id, revision: 1 })).character
}
/** A campaign run by `gm` that `alice` and `bob` have joined as players. */
async function table() {
  const { campaignId } = ok(await createCampaign(db, 'gm', { name: 'The Table' }))
  const { token } = ok(await createInvite(db, 'gm', { campaignId }))
  ok(await acceptInvite(db, 'alice', { token }))
  ok(await acceptInvite(db, 'bob', { token }))
  return campaignId
}
const scalar = async <T>(sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).first<{ v: T }>())!.v
const usesOf = (token: string) => scalar<number>('SELECT uses AS v FROM campaign_invite WHERE token = ?', token)
const membersOf = (campaignId: string) => scalar<number>('SELECT COUNT(*) AS v FROM campaign_member WHERE campaign_id = ?', campaignId)
const eventCount = (characterId: string) => scalar<number>('SELECT COUNT(*) AS v FROM character_event WHERE character_id = ?', characterId)

// ---- Campaigns ---------------------------------------------------------------------------------

test('createCampaign inserts the creator as gm; listMyCampaigns shows it with the role; a name is required', async () => {
  const { campaignId } = ok(await createCampaign(db, 'gm', { name: '  The Table  ' }))
  assert.equal(await scalar<string>('SELECT name AS v FROM campaign WHERE id = ?', campaignId), 'The Table')
  assert.equal(await scalar<string>("SELECT role AS v FROM campaign_member WHERE campaign_id = ? AND user_id = 'gm'", campaignId), 'gm')
  const mine = ok(await listMyCampaigns(db, 'gm')).campaigns
  assert.deepEqual(mine.map((c) => [c.id, c.role, c.currentDay, c.memberCount]), [[campaignId, 'gm', 1, 1]])
  assert.deepEqual(ok(await listMyCampaigns(db, 'stranger')).campaigns, [])
  refused(await createCampaign(db, 'gm', { name: '   ' }), 400, 'bad_input')
})

test('getCampaign: members only, with members, current_day and character cards; drafts are not cards', async () => {
  const campaignId = await table()
  const ysolde = await finishedCharacter('alice')
  ok(await assignCharacterToCampaign(db, 'alice', { characterId: ysolde.id, campaignId }))
  const draft = builder()
  ok(await createDraft(db, 'bob', { builder: draft }))
  await db.prepare('UPDATE campaign SET current_day = 9 WHERE id = ?').bind(campaignId).run()

  const seenByGm = ok(await getCampaign(db, 'gm', { campaignId })).campaign
  assert.equal(seenByGm.role, 'gm')
  assert.equal(seenByGm.currentDay, 9)
  assert.deepEqual(seenByGm.members.map((m) => [m.userId, m.role]), [['gm', 'gm'], ['alice', 'player'], ['bob', 'player']])
  assert.equal(seenByGm.characters.length, 1)
  const card = seenByGm.characters[0]
  assert.equal(card.name, 'Ysolde')
  assert.equal(card.ownerName, 'alice')
  assert.equal(card.hp.current, ysolde.derived!.effectiveMaxHp)
  assert.equal(card.hp.effectiveMax, ysolde.derived!.effectiveMaxHp)
  assert.equal(card.heartDie.max, ysolde.derived!.maxHeartDie)
  assert.equal(card.woundCount, 0)
  assert.deepEqual(card.conditions, [])
  assert.equal(ok(await getCampaign(db, 'bob', { campaignId })).campaign.role, 'player')
  refused(await getCampaign(db, 'stranger', { campaignId }), 403, 'forbidden')
})

// ---- Invites -----------------------------------------------------------------------------------

test('an invite token is 16 random bytes as 22 base64url characters; it expires in 7 days; only the GM creates one', async () => {
  const { campaignId } = ok(await createCampaign(db, 'gm', { name: 'T' }))
  const invite = ok(await createInvite(db, 'gm', { campaignId }))
  assert.match(invite.token, /^[A-Za-z0-9_-]{22}$/)
  assert.equal(invite.path, `/join/${invite.token}`)
  const days = (Date.parse(invite.expiresAt) - Date.now()) / 86_400_000
  assert.ok(days > 6.99 && days <= 7, `expires in ${days} days`)
  assert.equal(invite.maxUses, null)
  const second = ok(await createInvite(db, 'gm', { campaignId }))
  assert.notEqual(second.token, invite.token)

  const { token } = invite
  ok(await acceptInvite(db, 'alice', { token }))
  refused(await createInvite(db, 'alice', { campaignId }), 403, 'forbidden')
  refused(await createInvite(db, 'stranger', { campaignId }), 403, 'forbidden')
  refused(await createInvite(db, 'gm', { campaignId, maxUses: 0 }), 400, 'bad_input')
})

test('acceptInvite joins as a player and consumes one use; a second accept by the member consumes none', async () => {
  const { campaignId } = ok(await createCampaign(db, 'gm', { name: 'T' }))
  const { token } = ok(await createInvite(db, 'gm', { campaignId }))
  const first = ok(await acceptInvite(db, 'alice', { token }))
  assert.deepEqual([first.campaignId, first.joined], [campaignId, true])
  assert.equal(await usesOf(token), 1)
  assert.equal(await scalar<string>("SELECT role AS v FROM campaign_member WHERE campaign_id = ? AND user_id = 'alice'", campaignId), 'player')

  const again = ok(await acceptInvite(db, 'alice', { token }))
  assert.deepEqual([again.campaignId, again.joined], [campaignId, false])
  assert.equal(await usesOf(token), 1)
  assert.equal(await membersOf(campaignId), 2)

  // The GM opening their own link is a member too: straight through, no use, role unchanged.
  const gm = ok(await acceptInvite(db, 'gm', { token }))
  assert.equal(gm.joined, false)
  assert.equal(await usesOf(token), 1)
  assert.equal(await scalar<string>("SELECT role AS v FROM campaign_member WHERE campaign_id = ? AND user_id = 'gm'", campaignId), 'gm')
})

test('an expired or unknown invite is refused with the expiry message and joins nobody', async () => {
  const { campaignId } = ok(await createCampaign(db, 'gm', { name: 'T' }))
  const { token } = ok(await createInvite(db, 'gm', { campaignId }))
  await db.prepare("UPDATE campaign_invite SET expires_at = '2020-01-01T00:00:00.000Z' WHERE token = ?").bind(token).run()
  const r = refused(await acceptInvite(db, 'alice', { token }), 410, 'invite_expired')
  assert.equal(r.message, 'This invite has expired; ask your GM for a new one')
  assert.equal(await usesOf(token), 0)
  assert.equal(await membersOf(campaignId), 1)
  refused(await acceptInvite(db, 'alice', { token: 'no-such-token-at-all-xx' }), 410, 'invite_expired')
  // A member whose link has expired still goes straight to the campaign.
  ok(await acceptInvite(db, 'gm', { token }))
})

test('max_uses: the use after the last is refused, and a member re-opening it does not count', async () => {
  const { campaignId } = ok(await createCampaign(db, 'gm', { name: 'T' }))
  const { token } = ok(await createInvite(db, 'gm', { campaignId, maxUses: 2 }))
  ok(await acceptInvite(db, 'alice', { token }))
  ok(await acceptInvite(db, 'bob', { token }))
  assert.equal(await usesOf(token), 2)
  refused(await acceptInvite(db, 'carol', { token }), 410, 'invite_expired')
  assert.equal(await usesOf(token), 2)
  assert.equal(await membersOf(campaignId), 3)
  assert.equal(ok(await acceptInvite(db, 'alice', { token })).joined, false)
})

test('two concurrent accepts of the last use → exactly one membership and uses = max_uses', async () => {
  for (let round = 0; round < 5; round++) {
    const { campaignId } = ok(await createCampaign(db, 'gm', { name: `T${round}` }))
    const { token } = ok(await createInvite(db, 'gm', { campaignId, maxUses: 1 }))
    const results = await Promise.all([acceptInvite(db, 'alice', { token }), acceptInvite(db, 'bob', { token })])
    assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results))
    refused(results.find((r) => !r.ok)!, 410, 'invite_expired')
    assert.equal(await usesOf(token), 1)
    assert.equal(await membersOf(campaignId), 2, 'the GM and exactly one new player')
  }
})

test('the same user accepting twice at once consumes one use', async () => {
  const { campaignId } = ok(await createCampaign(db, 'gm', { name: 'T' }))
  const { token } = ok(await createInvite(db, 'gm', { campaignId }))
  const results = await Promise.all([acceptInvite(db, 'alice', { token }), acceptInvite(db, 'alice', { token })])
  assert.ok(results.every((r) => r.ok))
  assert.equal(results.filter((r) => r.ok && r.joined).length, 1)
  assert.equal(await usesOf(token), 1)
  assert.equal(await membersOf(campaignId), 2)
})

// ---- Characters in a campaign ------------------------------------------------------------------

test('assign / remove: owner only, finished characters only, one campaign per character', async () => {
  const campaignId = await table()
  const other = ok(await createCampaign(db, 'alice', { name: 'Alice runs this' })).campaignId
  const ysolde = await finishedCharacter('alice')

  refused(await assignCharacterToCampaign(db, 'bob', { characterId: ysolde.id, campaignId }), 403, 'forbidden')
  refused(await assignCharacterToCampaign(db, 'gm', { characterId: ysolde.id, campaignId }), 403, 'forbidden')
  refused(await assignCharacterToCampaign(db, 'alice', { characterId: ysolde.id, campaignId: 'no-such-campaign' }), 403, 'forbidden')
  refused(await assignCharacterToCampaign(db, 'alice', { characterId: 'no-such-character', campaignId }), 404, 'not_found')

  ok(await assignCharacterToCampaign(db, 'alice', { characterId: ysolde.id, campaignId }))
  assert.equal(ok(await getCharacter(db, 'gm', { characterId: ysolde.id })).character.campaignId, campaignId, 'the GM can now read it')
  ok(await assignCharacterToCampaign(db, 'alice', { characterId: ysolde.id, campaignId })) // already there: no-op
  refused(await assignCharacterToCampaign(db, 'alice', { characterId: ysolde.id, campaignId: other }), 409, 'already_in_campaign')
  assert.equal(await scalar<number>('SELECT revision AS v FROM character WHERE id = ?', ysolde.id), 1, 'membership is not character state')

  refused(await removeCharacterFromCampaign(db, 'bob', { characterId: ysolde.id }), 403, 'forbidden')
  refused(await removeCharacterFromCampaign(db, 'gm', { characterId: ysolde.id }), 403, 'forbidden')
  assert.equal(ok(await removeCharacterFromCampaign(db, 'alice', { characterId: ysolde.id })).campaignId, campaignId)
  refused(await removeCharacterFromCampaign(db, 'alice', { characterId: ysolde.id }), 409, 'not_in_campaign')
  ok(await assignCharacterToCampaign(db, 'alice', { characterId: ysolde.id, campaignId: other }))
})

test('a draft is refused, and a non-member cannot add a character', async () => {
  const campaignId = await table()
  const draft = builder()
  ok(await createDraft(db, 'alice', { builder: draft }))
  refused(await assignCharacterToCampaign(db, 'alice', { characterId: draft.id, campaignId }), 409, 'is_draft')
  const stray = await finishedCharacter('stranger')
  refused(await assignCharacterToCampaign(db, 'stranger', { characterId: stray.id, campaignId }), 403, 'forbidden')
  assert.equal(await scalar<string | null>('SELECT campaign_id AS v FROM character WHERE id = ?', stray.id), null)
})

test('a player forcing an action on the GM\'s character → 403; the GM may edit a player\'s character', async () => {
  const campaignId = await table()
  const gmsNpc = await finishedCharacter('gm')
  const alices = await finishedCharacter('alice')
  ok(await assignCharacterToCampaign(db, 'gm', { characterId: gmsNpc.id, campaignId }))
  ok(await assignCharacterToCampaign(db, 'alice', { characterId: alices.id, campaignId }))
  const note: ClientAction = { kind: 'notes:set', text: 'forced', id: ulid(), at: at() }
  const forced = await applyCharacterAction(db, 'alice', { characterId: gmsNpc.id, revision: 1, action: note })
  assert.equal(forced.ok, false)
  assert.equal((forced as { status: number }).status, 403)
  assert.equal(await eventCount(gmsNpc.id), 0)
  const byGm = await applyCharacterAction(db, 'gm', { characterId: alices.id, revision: 1, action: { ...note, id: ulid() } })
  assert.equal(byGm.ok, true)
})

// ---- Award XP ----------------------------------------------------------------------------------

async function withCharacters(campaignId: string) {
  const a = await finishedCharacter('alice', { name: 'A' })
  const b = await finishedCharacter('bob', { name: 'B' })
  const gm = await finishedCharacter('gm', { name: 'G' })
  for (const [owner, c] of [['alice', a], ['bob', b], ['gm', gm]] as const) ok(await assignCharacterToCampaign(db, owner, { characterId: c.id, campaignId }))
  const unassigned = await finishedCharacter('alice', { name: 'Elsewhere' })
  return { a, b, gm, unassigned }
}
const awardedOf = (id: string) => scalar<number>("SELECT json_extract(state, '$.xp.awarded') AS v FROM character WHERE id = ?", id)
const sessionAwards = (id: string) => scalar<string>('SELECT xp_awards AS v FROM campaign_session WHERE id = ?', id)

test('Award XP: GM only, a whole number ≥ 1', async () => {
  const campaignId = await table()
  const { a } = await withCharacters(campaignId)
  refused(await awardXpToCampaign(db, 'alice', { campaignId, amount: 3 }), 403, 'forbidden')
  refused(await awardXpToCampaign(db, 'stranger', { campaignId, amount: 3 }), 403, 'forbidden')
  refused(await awardXpToCampaign(db, 'gm', { campaignId, amount: 0 }), 400, 'bad_input')
  refused(await awardXpToCampaign(db, 'gm', { campaignId, amount: 1.5 }), 400, 'bad_input')
  assert.equal(await eventCount(a.id), 0)
})

test('Award XP to all: one xp:award event per character in the campaign, none for a character elsewhere or a draft', async () => {
  const campaignId = await table()
  const { a, b, gm, unassigned } = await withCharacters(campaignId)
  const before = await awardedOf(a.id)
  const result = ok(await awardXpToCampaign(db, 'gm', { campaignId, amount: 3 }))
  assert.equal(result.awarded.length, 3)
  assert.deepEqual(result.failed, [])
  assert.equal(result.sessionId, null)
  for (const c of [a, b, gm]) {
    assert.equal(await eventCount(c.id), 1)
    assert.equal(await scalar<string>("SELECT json_extract(action, '$.kind') AS v FROM character_event WHERE character_id = ?", c.id), 'xp:award')
    assert.equal(await scalar<number>('SELECT revision AS v FROM character WHERE id = ?', c.id), 2)
    assert.equal(await awardedOf(c.id), before + 3)
  }
  assert.equal(await eventCount(unassigned.id), 0)
  assert.equal(await awardedOf(unassigned.id), before)
})

test('Award XP applies the xp:award reducer, so Craven\'s bonus applies', { skip: CRAVEN ? false : 'no Craven in the catalogue' }, async () => {
  const campaignId = await table()
  const craven = await finishedCharacter('alice', { raceId: CRAVEN!.id })
  ok(await assignCharacterToCampaign(db, 'alice', { characterId: craven.id, campaignId }))
  const before = await awardedOf(craven.id)
  ok(await awardXpToCampaign(db, 'gm', { campaignId, amount: 14 }))
  assert.equal(await awardedOf(craven.id), before + 16)
})

test('spec criterion 4: with an open session the award shows on it; with none no session changes', async () => {
  const campaignId = await table()
  await withCharacters(campaignId)
  await db.prepare("INSERT INTO campaign_session (id, campaign_id, number, real_date, start_day, end_day) VALUES ('s0', ?, 1, '2026-10-01', 1, 3)").bind(campaignId).run()

  // No open session (Session 1 has ended): events are written, the closed session is untouched.
  const none = ok(await awardXpToCampaign(db, 'gm', { campaignId, amount: 2 }))
  assert.equal(none.sessionId, null)
  assert.equal(none.awarded.length, 3)
  assert.equal(await sessionAwards('s0'), '[]')

  await db.prepare("INSERT INTO campaign_session (id, campaign_id, number, real_date, start_day) VALUES ('s1', ?, 2, '2026-10-20', 3)").bind(campaignId).run()
  const open = ok(await awardXpToCampaign(db, 'gm', { campaignId, amount: 3 }))
  assert.equal(open.sessionId, 's1')
  assert.equal(open.awarded.length, 3)
  const logged = JSON.parse(await sessionAwards('s1')) as { amount: number; at: string }[]
  assert.equal(logged.length, 1, 'one entry for the award, not one per character')
  assert.equal(logged[0].amount, 3)
  assert.ok(!Number.isNaN(Date.parse(logged[0].at)))
  assert.equal(await sessionAwards('s0'), '[]')
  ok(await awardXpToCampaign(db, 'gm', { campaignId, amount: 1 }))
  assert.deepEqual((JSON.parse(await sessionAwards('s1')) as { amount: number }[]).map((x) => x.amount), [3, 1])
})

test('Award XP is all or nothing: a character that leaves before the batch rolls it back, and the next read awards exactly the remaining set', async () => {
  const campaignId = await table()
  const { a, b, gm } = await withCharacters(campaignId)
  await db.prepare("INSERT INTO campaign_session (id, campaign_id, number, real_date, start_day) VALUES ('s1', ?, 1, '2026-10-20', 1)").bind(campaignId).run()
  const before = [await awardedOf(a.id), await awardedOf(b.id), await awardedOf(gm.id)]
  // The first read (all three) is overtaken: after it, Bob's character is removed. The batch must write nothing for A or the GM.
  let removed = false
  const racing = new Proxy(db, {
    get(target, prop) {
      if (prop === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          if (!removed) {
            removed = true
            ok(await removeCharacterFromCampaign(target, 'bob', { characterId: b.id }))
          }
          return target.batch(statements)
        }
      }
      const v = Reflect.get(target, prop)
      return typeof v === 'function' ? v.bind(target) : v
    },
  }) as D1
  const result = ok(await awardXpToCampaign(racing, 'gm', { campaignId, amount: 3 }))
  assert.equal(removed, true)
  assert.deepEqual(result.awarded.map((x) => x.characterId).sort(), [a.id, gm.id].sort())
  assert.equal(await awardedOf(a.id), before[0] + 3)
  assert.equal(await awardedOf(gm.id), before[2] + 3)
  assert.equal(await awardedOf(b.id), before[1], 'the removed character got nothing')
  assert.equal(await eventCount(b.id), 0)
  assert.equal(await eventCount(a.id), 1, 'one event, not one from the rolled-back attempt as well')
  const logged = JSON.parse(await sessionAwards('s1')) as { amount: number }[]
  assert.equal(logged.length, 1, 'the session records the award once, for the set that received it')
})

test('Award XP: a batch that cannot commit writes no event and no session record', async () => {
  const campaignId = await table()
  const { a, b, gm } = await withCharacters(campaignId)
  await db.prepare("INSERT INTO campaign_session (id, campaign_id, number, real_date, start_day) VALUES ('s1', ?, 1, '2026-10-20', 1)").bind(campaignId).run()
  // Every attempt finds Bob's revision moved on, so the batch aborts each time; the award gives up with a conflict.
  const stale = new Proxy(db, {
    get(target, prop) {
      if (prop === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          await target.prepare('UPDATE character SET revision = revision + 1 WHERE id = ?').bind(b.id).run()
          return target.batch(statements)
        }
      }
      const v = Reflect.get(target, prop)
      return typeof v === 'function' ? v.bind(target) : v
    },
  }) as D1
  refused(await awardXpToCampaign(stale, 'gm', { campaignId, amount: 3 }), 409, 'conflict')
  for (const c of [a, b, gm]) assert.equal(await eventCount(c.id), 0)
  assert.equal(await sessionAwards('s1'), '[]')
})

test('an award to a campaign with no characters writes no session entry', async () => {
  const campaignId = await table()
  await db.prepare("INSERT INTO campaign_session (id, campaign_id, number, real_date, start_day) VALUES ('s1', ?, 1, '2026-10-20', 1)").bind(campaignId).run()
  const result = ok(await awardXpToCampaign(db, 'gm', { campaignId, amount: 3 }))
  assert.deepEqual(result.awarded, [])
  assert.equal(result.sessionId, null)
  assert.equal(await sessionAwards('s1'), '[]')
})

// ---- Live updates (INV-LIVE) -------------------------------------------------------------------

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
  } as unknown as Parameters<typeof publishCampaignChange>[0]
  return { env, events }
}

test('publishing: a membership or character-list change sends {type: campaign}; an award sends each character and the session', async () => {
  const { env, events } = fakeChannel()
  await publishCampaignChange(env, 'camp')
  await publishCampaignChange(env, null)
  assert.deepEqual(events, [{ campaign: 'camp', event: { type: 'campaign' } }])

  events.length = 0
  await publishAward(env, 'camp', { ok: true, awarded: [{ characterId: 'c1', revision: 2 }, { characterId: 'c2', revision: 5 }], failed: [], sessionId: 's1' })
  assert.deepEqual(events.map((e) => e.event), [
    { type: 'character', characterId: 'c1', revision: 2 },
    { type: 'character', characterId: 'c2', revision: 5 },
    { type: 'campaign' },
  ])
  events.length = 0
  await publishAward(env, 'camp', { ok: true, awarded: [{ characterId: 'c1', revision: 2 }], failed: [], sessionId: null })
  assert.equal(events.length, 1)
  events.length = 0
  await publishAward(env, 'camp', refusedValue())
  assert.equal(events.length, 0)
})

function refusedValue(): CampaignRefusal {
  return { ok: false, status: 403, code: 'forbidden', message: 'x' }
}
