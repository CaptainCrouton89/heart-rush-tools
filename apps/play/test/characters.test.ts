import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ulid } from 'ulid'
import type { BuilderInput, ClientAction } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../src/catalogue'
import { canRead, canWrite, roleIn } from '../src/server/authz'
import {
  applyCharacterAction, createDraft, finishDraft, getCharacter, listCharacters, listEvents, saveDraft, undoCharacterEvent,
  type CharacterDoc, type CharacterResult, type Refusal,
} from '../src/server/characters'
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
  for (const id of ['owner', 'stranger', 'player', 'other', 'gm']) await db.prepare('INSERT INTO user (id, display_name) VALUES (?, ?)').bind(id, id).run()
})

const cat = getCatalogue()
const CENTAUR = [...cat.races.values()].find((r) => r.title === 'Centaur')!

const at = () => new Date().toISOString()
function builder(overrides: Partial<BuilderInput> = {}): BuilderInput {
  assert.equal(CENTAUR.choices.length, 0, 'the fixture race has no kin choices')
  assert.equal(CENTAUR.subraces.length, 0, 'the fixture race has no subraces')
  return {
    id: ulid(), at: at(), name: 'Ysolde', pronouns: 'she/her', dream: '', description: '', motivation: '', portrait: null,
    raceId: CENTAUR.id, subraceId: null, kinChoices: {},
    dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
    ageCategory: 'adult', ageBenefits: [], createdAspects: ['Loyal', 'Stubborn'],
    professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel: 1,
    ...overrides,
  }
}
/** An action that always applies: it needs no XP and no catalogue data. */
const addItem = (name = 'Rope'): ClientAction => ({ kind: 'gear:item:add', item: { name, slots: 1, quantity: 1, notes: '' }, id: ulid(), at: at() })

function ok(result: CharacterResult): CharacterDoc {
  assert.ok(result.ok, `expected success, got ${JSON.stringify(result.ok ? null : { ...result, character: undefined })}`)
  return result.character
}
function refused(result: CharacterResult | Awaited<ReturnType<typeof listEvents>>, code: string, status?: number): Refusal {
  assert.equal(result.ok, false, 'expected a refusal')
  const r = result as Refusal
  assert.equal(r.code, code, r.message)
  if (status) assert.equal(r.status, status)
  return r
}
const items = (doc: CharacterDoc) => (doc.state.draft ? [] : doc.state.gear.items.map((i) => i.name))

/** A finished character at `revision` 1 + n (n item-add events at seq 2 … n+1). */
async function finished(ownerId = 'owner', n = 0): Promise<{ doc: CharacterDoc; actions: ClientAction[] }> {
  const draft = ok(await createDraft(db, ownerId, { builder: builder() }))
  const actions = Array.from({ length: n }, (_, i) => addItem(`Item ${i + 1}`))
  const saved = ok(await saveDraft(db, ownerId, { characterId: draft.id, revision: 1, builder: (draft.state as { builder: BuilderInput }).builder, pending: actions }))
  return { doc: ok(await finishDraft(db, ownerId, { characterId: saved.id, revision: saved.revision })), actions }
}
const eventCount = async (characterId: string) =>
  (await db.prepare('SELECT COUNT(*) AS n FROM character_event WHERE character_id = ?').bind(characterId).first<{ n: number }>())!.n
const revisionOf = async (characterId: string) =>
  (await db.prepare('SELECT revision FROM character WHERE id = ?').bind(characterId).first<{ revision: number }>())!.revision
const seqs = async (characterId: string) =>
  (await db.prepare('SELECT seq FROM character_event WHERE character_id = ? ORDER BY seq').bind(characterId).all<{ seq: number }>()).results.map((r) => r.seq)

// ---- Criterion 15b ---------------------------------------------------------------------------------------

test('15b: two concurrent applies on revision 7 → one revision 8 with one event at seq 8, the other conflict with the current document', async () => {
  const { doc } = await finished('owner', 6)
  assert.equal(doc.revision, 7)
  const a = addItem('A')
  const b = addItem('B')
  const results = await Promise.all([
    applyCharacterAction(db, 'owner', { characterId: doc.id, revision: 7, action: a }),
    applyCharacterAction(db, 'owner', { characterId: doc.id, revision: 7, action: b }),
  ])
  const winners = results.filter((r) => r.ok)
  const losers = results.filter((r) => !r.ok)
  assert.equal(winners.length, 1)
  assert.equal(losers.length, 1)
  const won = ok(winners[0])
  assert.equal(won.revision, 8)
  const lost = refused(losers[0], 'conflict', 409)
  assert.equal(lost.character!.revision, 8, 'the conflict carries the current document')
  assert.deepEqual(items(lost.character!), items(won))
  assert.equal(await revisionOf(doc.id), 8)
  assert.equal(await eventCount(doc.id), 7, 'six from finishing plus exactly one')
  assert.deepEqual((await seqs(doc.id)).slice(-2), [7, 8])
  const eight = await db.prepare('SELECT COUNT(*) AS n FROM character_event WHERE character_id = ? AND seq = 8').bind(doc.id).first<{ n: number }>()
  assert.equal(eight!.n, 1)
})

test('15b: a writer that passes the revision pre-check but loses the race inserts no event (the batch itself refuses)', async () => {
  const { doc } = await finished('owner', 6)
  // Another writer commits between this call's read and its batch.
  const racing = new Proxy(db, {
    get(target, prop) {
      if (prop === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          await target.prepare('UPDATE character SET revision = 8 WHERE id = ?').bind(doc.id).run()
          return target.batch(statements)
        }
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  const action = addItem('Late')
  const lost = refused(await applyCharacterAction(racing, 'owner', { characterId: doc.id, revision: 7, action }), 'conflict')
  assert.equal(lost.character!.revision, 8)
  assert.equal(await eventCount(doc.id), 6, 'no event row for the stale writer')
  assert.equal((await db.prepare('SELECT 1 AS found FROM character_event WHERE id = ?').bind(action.id).first()), null)
  assert.ok(!items(lost.character!).includes('Late'))
})

test('15b: an injected INSERT failure (a reused event id) leaves revision 7 and no event', async () => {
  const { doc, actions } = await finished('owner', 6)
  const before = (await db.prepare('SELECT state FROM character WHERE id = ?').bind(doc.id).first<{ state: string }>())!.state
  const reused = { ...addItem('Again'), id: actions[2].id }
  refused(await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: 7, action: reused }), 'duplicate_action', 409)
  assert.equal(await revisionOf(doc.id), 7)
  assert.equal(await eventCount(doc.id), 6)
  assert.equal((await db.prepare('SELECT state FROM character WHERE id = ?').bind(doc.id).first<{ state: string }>())!.state, before, 'the state is untouched')
})

test('a reused action id is refused even for a different character', async () => {
  const first = await finished('owner', 1)
  const second = await finished('owner', 0)
  const reused = { ...addItem('Copy'), id: first.actions[0].id }
  refused(await applyCharacterAction(db, 'owner', { characterId: second.doc.id, revision: 1, action: reused }), 'duplicate_action')
  assert.equal(await revisionOf(second.doc.id), 1)
})

// ---- finishDraft ----------------------------------------------------------------------------------------

test('finishDraft with two pending actions → revision 3, events at seq 2 and 3, state.draft false, a stale finish → conflict', async () => {
  const draft = ok(await createDraft(db, 'owner', { builder: builder() }))
  assert.equal(draft.revision, 1)
  assert.equal(draft.derived, null)
  const pending = [addItem('One'), addItem('Two')]
  const saved = ok(await saveDraft(db, 'owner', { characterId: draft.id, revision: 1, builder: builder({ id: draft.id }), pending }))
  assert.equal(saved.revision, 2)
  assert.equal(await eventCount(draft.id), 0, 'saving a draft writes no event')

  // A stale finish: the caller still holds revision 1.
  const stale = refused(await finishDraft(db, 'owner', { characterId: draft.id, revision: 1 }), 'conflict', 409)
  assert.equal(stale.character!.revision, 2)
  assert.equal(await eventCount(draft.id), 0)

  const done = ok(await finishDraft(db, 'owner', { characterId: draft.id, revision: 2 }))
  assert.equal(done.revision, 3)
  assert.equal(done.state.draft, false)
  assert.deepEqual(items(done), ['One', 'Two'])
  assert.ok(done.derived && done.derived.maxHp > 0)
  assert.deepEqual(await seqs(draft.id), [2, 3])
  const events = await db.prepare('SELECT id FROM character_event WHERE character_id = ? ORDER BY seq').bind(draft.id).all<{ id: string }>()
  assert.deepEqual(events.results.map((e) => e.id), pending.map((p) => p.id), 'the event id is the action id')
  assert.equal((await db.prepare('SELECT name FROM character WHERE id = ?').bind(draft.id).first<{ name: string }>())!.name, 'Ysolde')

  refused(await finishDraft(db, 'owner', { characterId: draft.id, revision: 3 }), 'not_a_draft')
  refused(await saveDraft(db, 'owner', { characterId: draft.id, revision: 3, builder: builder({ id: draft.id }), pending: [] }), 'not_a_draft')
})

test('finishDraft with no pending actions → a finished character at revision 1 and an empty undo stack', async () => {
  const { doc } = await finished('owner', 0)
  assert.equal(doc.revision, 1)
  assert.equal(doc.state.draft, false)
  assert.equal(await eventCount(doc.id), 0)
  const events = await listEvents(db, 'owner', { characterId: doc.id })
  assert.ok(events.ok)
  assert.deepEqual(events.events, [])
  assert.equal(events.topEventId, null)
})

test('finishDraft with an invalid pending action → draft_invalid naming it, and no write', async () => {
  const draft = ok(await createDraft(db, 'owner', { builder: builder() }))
  const bad: ClientAction = { kind: 'gear:item:remove', itemId: 'nope', id: ulid(), at: at() }
  const good = addItem('Fine')
  const saved = ok(await saveDraft(db, 'owner', { characterId: draft.id, revision: 1, builder: builder({ id: draft.id }), pending: [good, bad] }))
  const r = refused(await finishDraft(db, 'owner', { characterId: draft.id, revision: saved.revision }), 'draft_invalid', 422)
  assert.deepEqual(r.invalid!.map((i) => i.actionId), [bad.id])
  assert.match(r.message, new RegExp(bad.id))
  assert.equal(await revisionOf(draft.id), saved.revision)
  assert.equal(await eventCount(draft.id), 0)
  const still = ok(await getCharacter(db, 'owner', { characterId: draft.id }))
  assert.equal(still.state.draft, true)
})

test('finishDraft with a builder the engine refuses → draft_invalid and no write', async () => {
  const draft = ok(await createDraft(db, 'owner', { builder: builder() }))
  const broken = builder({ id: draft.id, raceId: 'player.kin-culture.nonexistent' })
  const saved = ok(await saveDraft(db, 'owner', { characterId: draft.id, revision: 1, builder: broken, pending: [] }))
  const r = refused(await finishDraft(db, 'owner', { characterId: draft.id, revision: saved.revision }), 'draft_invalid')
  assert.equal(r.invalid![0].actionId, null)
  assert.equal(r.invalid![0].code, 'unknown_race')
  assert.equal(await revisionOf(draft.id), saved.revision)
})

test('saveDraft with a stale revision → conflict with the current draft; createDraft with a used id → duplicate_id', async () => {
  const draft = ok(await createDraft(db, 'owner', { builder: builder() }))
  ok(await saveDraft(db, 'owner', { characterId: draft.id, revision: 1, builder: builder({ id: draft.id, name: 'Renamed' }), pending: [] }))
  const r = refused(await saveDraft(db, 'owner', { characterId: draft.id, revision: 1, builder: builder({ id: draft.id, name: 'Stale' }), pending: [] }), 'conflict')
  assert.equal(r.character!.name, 'Renamed')
  refused(await createDraft(db, 'owner', { builder: builder({ id: draft.id }) }), 'duplicate_id')
})

test('listCharacters flags drafts and lists only the caller’s own', async () => {
  const { doc } = await finished('owner', 0)
  const draft = ok(await createDraft(db, 'owner', { builder: builder({ name: 'Wip' }) }))
  ok(await createDraft(db, 'stranger', { builder: builder({ name: 'Theirs' }) }))
  const list = await listCharacters(db, 'owner')
  assert.deepEqual(list.characters.map((c) => [c.id, c.draft]).sort(), [[doc.id, false], [draft.id, true]].sort())
  assert.equal(list.characters.find((c) => c.id === doc.id)!.raceTitle, 'Centaur')
})

// ---- Undo ---------------------------------------------------------------------------------------------

test('a talent purchase is priced from the catalogue entry and the stored character, never from fields the client sends; undo refunds the real price', async () => {
  const gnome = [...getCatalogue().races.values()].find((r) => r.title === 'Gnome')!
  const martial = [...getCatalogue().talents.values()].find((x) => x.category === 'combat' && x.tradition === 'Martial')!
  const fire = [...getCatalogue().talents.values()].find((x) => x.category === 'elemental' && x.elements.includes('Fire'))!
  const b = builder({ raceId: gnome.id, subraceId: gnome.subraces[0]!.id, kinChoices: {}, bloodmarkLevel: 3 })
  const draft = ok(await createDraft(db, 'owner', { builder: b }))
  const doc = ok(await finishDraft(db, 'owner', { characterId: draft.id, revision: 1 }))
  const award = ok(await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: doc.revision, action: { kind: 'xp:award', amount: 30, id: ulid(), at: at() } }))

  // The client claims Handmagic (a Gnome discount) for a Martial talent, and claims an attunement it does not hold.
  const forged = (id: string, purchase: string, extra: object) => ({ kind: 'xp:buy', purchase, talent: { catalogueId: id }, ...extra, id: ulid(), at: at() }) as unknown as ClientAction
  const bought = ok(await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: award.revision, action: forged(martial.id, 'talent:combat', { target: { talent: { tradition: 'Handmagic' } } }) }))
  assert.ok(!bought.state.draft)
  assert.equal(bought.state.xp.purchases.at(-1)!.cost, 3, 'the Martial talent costs full price')
  refused(await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: bought.revision, action: forged(fire.id, 'talent:elemental', { target: { talent: { elements: [], attunementLevel: 'basic' } } }) }), 'not_attuned')
  refused(await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: bought.revision, action: forged('made-up', 'talent:combat', {}) }), 'not_found')

  const eventId = (await db.prepare('SELECT id FROM character_event WHERE character_id = ? ORDER BY seq DESC LIMIT 1').bind(doc.id).first<{ id: string }>())!.id
  const undone = ok(await undoCharacterEvent(db, 'owner', { characterId: doc.id, eventId }))
  assert.ok(!undone.state.draft)
  assert.equal(undone.state.xp.purchases.length, 0)
  assert.equal(undone.state.talents.filter((x) => x.catalogueId === martial.id).length, 0)
})

test('a pending draft purchase is priced the same way when the draft is finished', async () => {
  const gnome = [...getCatalogue().races.values()].find((r) => r.title === 'Gnome')!
  const martial = [...getCatalogue().talents.values()].find((x) => x.category === 'combat' && x.tradition === 'Martial')!
  const b = builder({ raceId: gnome.id, subraceId: gnome.subraces[0]!.id, kinChoices: {} })
  const draft = ok(await createDraft(db, 'owner', { builder: b }))
  const pending = [{ kind: 'xp:buy', purchase: 'talent:combat', talent: { catalogueId: martial.id }, target: { talent: { tradition: 'Handmagic' } }, id: ulid(), at: at() } as unknown as ClientAction]
  const saved = ok(await saveDraft(db, 'owner', { characterId: draft.id, revision: 1, builder: b, pending }))
  const done = ok(await finishDraft(db, 'owner', { characterId: draft.id, revision: saved.revision }))
  assert.ok(!done.state.draft)
  assert.equal(done.state.xp.purchases[0]!.cost, 3)
})

test('undo of the top event works; undo of an older event → not_top_of_stack; an undone event or an undo event is not offered', async () => {
  const { doc } = await finished('owner', 0)
  const a = addItem('A')
  const b = addItem('B')
  const afterA = ok(await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: 1, action: a }))
  const afterB = ok(await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: afterA.revision, action: b }))
  assert.deepEqual(items(afterB), ['A', 'B'])

  refused(await undoCharacterEvent(db, 'owner', { characterId: doc.id, eventId: a.id }), 'not_top_of_stack', 409)
  refused(await undoCharacterEvent(db, 'owner', { characterId: doc.id, eventId: 'missing' }), 'not_found')
  assert.equal(await revisionOf(doc.id), 3)

  const undone = ok(await undoCharacterEvent(db, 'owner', { characterId: doc.id, eventId: b.id }))
  assert.deepEqual(items(undone), ['A'])
  assert.equal(undone.revision, 4)
  const rows = await db.prepare('SELECT id, seq, undone, action FROM character_event WHERE character_id = ? ORDER BY seq').bind(doc.id).all<{ id: string; seq: number; undone: number; action: string }>()
  assert.deepEqual(rows.results.map((r) => [r.seq, r.undone]), [[2, 0], [3, 1], [4, 0]])
  const undoEvent = JSON.parse(rows.results[2].action)
  assert.equal(undoEvent.kind, 'undo')
  assert.equal(undoEvent.of, b.id)
  assert.match(undoEvent.id, /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/, 'the undo event id is generated on the server')

  refused(await undoCharacterEvent(db, 'owner', { characterId: doc.id, eventId: b.id }), 'not_top_of_stack')
  refused(await undoCharacterEvent(db, 'owner', { characterId: doc.id, eventId: undoEvent.id }), 'not_top_of_stack')
  const listed = await listEvents(db, 'owner', { characterId: doc.id })
  assert.ok(listed.ok)
  assert.equal(listed.topEventId, a.id)
  assert.deepEqual(listed.events.map((e) => e.seq), [4, 3, 2], 'newest first')

  const again = ok(await undoCharacterEvent(db, 'owner', { characterId: doc.id, eventId: a.id }))
  assert.deepEqual(items(again), [])
  assert.equal(again.revision, 5)
})

test('a stale undo (the character moved on between read and write) → conflict, nothing marked undone', async () => {
  const { doc } = await finished('owner', 0)
  const a = addItem('A')
  ok(await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: 1, action: a }))
  const racing = new Proxy(db, {
    get(target, prop) {
      if (prop === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          await target.prepare('UPDATE character SET revision = 3 WHERE id = ?').bind(doc.id).run()
          return target.batch(statements)
        }
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  refused(await undoCharacterEvent(racing, 'owner', { characterId: doc.id, eventId: a.id }), 'conflict')
  assert.equal(await eventCount(doc.id), 1)
  assert.equal((await db.prepare('SELECT undone FROM character_event WHERE id = ?').bind(a.id).first<{ undone: number }>())!.undone, 0)
})

// ---- Client input (INV-INTERNAL, INV-DET) -----------------------------------------------------------------

test('a client-sent restore or undo → bad_action; a malformed id or time → bad_action; a rule refusal keeps its engine code', async () => {
  const { doc } = await finished('owner', 0)
  const send = (action: unknown) => applyCharacterAction(db, 'owner', { characterId: doc.id, revision: 1, action: action as ClientAction })
  refused(await send({ kind: 'restore', slices: { notes: 'hacked' }, id: ulid(), at: at() }), 'bad_action', 400)
  refused(await send({ kind: 'undo', of: 'x', id: ulid(), at: at() }), 'bad_action', 400)
  refused(await send({ ...addItem(), id: 'not-a-ulid' }), 'bad_action')
  refused(await send({ ...addItem(), at: 'yesterday' }), 'bad_action')
  refused(await send({ kind: 'nope', id: ulid(), at: at() }), 'bad_action')
  refused(await send(null), 'bad_action')
  refused(await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: 0, action: addItem() }), 'bad_input')
  const r = refused(await send({ kind: 'damage', amount: -3, id: ulid(), at: at() }), 'invalid_amount', 422)
  assert.equal(r.status, 422)
  assert.equal(await revisionOf(doc.id), 1)
  assert.equal(await eventCount(doc.id), 0)
})

test('an action on a draft is refused (drafts change only through saveDraft)', async () => {
  const draft = ok(await createDraft(db, 'owner', { builder: builder() }))
  refused(await applyCharacterAction(db, 'owner', { characterId: draft.id, revision: 1, action: addItem() }), 'is_draft')
})

// ---- Authorization -------------------------------------------------------------------------------------

async function campaign() {
  await db.prepare('INSERT INTO campaign (id, name, gm_user_id) VALUES (?, ?, ?)').bind('camp', 'The Table', 'gm').run()
  for (const [user, role] of [['gm', 'gm'], ['player', 'player'], ['other', 'player']] as const) {
    await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('camp', user, role).run()
  }
}
const join = (characterId: string) => db.prepare("UPDATE character SET campaign_id = 'camp' WHERE id = ?").bind(characterId).run()

test('roleIn answers gm, player or null', async () => {
  await campaign()
  assert.equal(await roleIn(db, 'camp', 'gm'), 'gm')
  assert.equal(await roleIn(db, 'camp', 'player'), 'player')
  assert.equal(await roleIn(db, 'camp', 'stranger'), null)
  assert.equal(await roleIn(db, 'nowhere', 'gm'), null)
})

test('a non-member read → 403; members read; a stranger cannot read a character in no campaign', async () => {
  await campaign()
  const { doc } = await finished('player', 0)
  refused(await getCharacter(db, 'stranger', { characterId: doc.id }), 'forbidden', 403)
  refused(await getCharacter(db, 'gm', { characterId: doc.id }), 'forbidden', 403) // not yet in the campaign
  await join(doc.id)
  refused(await getCharacter(db, 'stranger', { characterId: doc.id }), 'forbidden', 403)
  assert.equal(ok(await getCharacter(db, 'other', { characterId: doc.id })).role, 'player')
  assert.equal(ok(await getCharacter(db, 'gm', { characterId: doc.id })).role, 'gm')
  assert.equal(ok(await getCharacter(db, 'player', { characterId: doc.id })).role, 'owner')
  refused(await listEvents(db, 'stranger', { characterId: doc.id }), 'forbidden', 403)
  assert.ok((await listEvents(db, 'other', { characterId: doc.id })).ok)
  refused(await getCharacter(db, 'owner', { characterId: 'missing' }), 'not_found', 404)
})

test('a campaign player’s write to another player’s character → 403; a GM write → allowed; the owner writes', async () => {
  await campaign()
  const { doc } = await finished('player', 0)
  await join(doc.id)
  const attempt = addItem('Stolen')
  refused(await applyCharacterAction(db, 'other', { characterId: doc.id, revision: 1, action: attempt }), 'forbidden', 403)
  refused(await applyCharacterAction(db, 'stranger', { characterId: doc.id, revision: 1, action: attempt }), 'forbidden', 403)
  assert.equal(await revisionOf(doc.id), 1)
  assert.equal(await eventCount(doc.id), 0)

  const byGm = ok(await applyCharacterAction(db, 'gm', { characterId: doc.id, revision: 1, action: addItem('Reward') }))
  assert.deepEqual(items(byGm), ['Reward'])
  const actor = await db.prepare('SELECT actor_user_id FROM character_event WHERE character_id = ?').bind(doc.id).first<{ actor_user_id: string }>()
  assert.equal(actor!.actor_user_id, 'gm', 'the event records who acted')
  ok(await applyCharacterAction(db, 'player', { characterId: doc.id, revision: 2, action: addItem('Mine') }))

  refused(await undoCharacterEvent(db, 'other', { characterId: doc.id, eventId: attempt.id }), 'forbidden', 403)
  const top = (await listEvents(db, 'gm', { characterId: doc.id }))
  assert.ok(top.ok && top.topEventId)
  ok(await undoCharacterEvent(db, 'gm', { characterId: doc.id, eventId: top.topEventId }))
})

test('canRead / canWrite: a draft is readable by nobody but its owner, even in a campaign', async () => {
  await campaign()
  const draft = ok(await createDraft(db, 'player', { builder: builder() }))
  await join(draft.id)
  const access = { ownerUserId: 'player', campaignId: 'camp', draft: true }
  assert.equal(await canRead(db, 'player', access), true)
  assert.equal(await canWrite(db, 'player', access), true)
  for (const user of ['gm', 'other', 'stranger']) {
    assert.equal(await canRead(db, user, access), false, user)
    assert.equal(await canWrite(db, user, access), false, user)
    refused(await getCharacter(db, user, { characterId: draft.id }), 'forbidden', 403)
  }
  refused(await saveDraft(db, 'gm', { characterId: draft.id, revision: 1, builder: builder({ id: draft.id }), pending: [] }), 'forbidden', 403)
  refused(await finishDraft(db, 'gm', { characterId: draft.id, revision: 1 }), 'forbidden', 403)
  const finishedAccess = { ownerUserId: 'player', campaignId: 'camp', draft: false }
  assert.equal(await canRead(db, 'other', finishedAccess), true)
  assert.equal(await canWrite(db, 'other', finishedAccess), false)
  assert.equal(await canWrite(db, 'gm', finishedAccess), true)
  assert.equal(await canRead(db, 'stranger', finishedAccess), false)
})

test('getCharacter returns the derived bundle for a finished character', async () => {
  const { doc } = await finished('owner', 0)
  const got = ok(await getCharacter(db, 'owner', { characterId: doc.id }))
  assert.ok(got.derived)
  assert.equal(got.derived.maxHp, got.derived.effectiveMaxHp + got.derived.woundPenalty)
  assert.equal(got.derived.xp.remaining, got.derived.xp.awarded - got.derived.xp.spent)
  assert.deepEqual(Object.keys(got.derived.disadvantage).sort(), ['agility', 'cunning', 'might', 'presence'])
})
