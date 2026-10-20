import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ulid } from 'ulid'
import { applyAction } from '@heartrush/rules-engine/actions'
import { createCharacter } from '@heartrush/rules-engine/create'
import type { BuilderInput, Character, ClientAction } from '@heartrush/rules-engine/types'
import { createDispatcher, FAILED_BEFORE_TEXT, type Dispatcher, type Outcome, type Transport } from '../src/components/sheet/use-character'
import { NO_CONNECTION_TEXT, refusalText } from '../src/components/sheet/refusal-text'
import { getCatalogue } from '../src/catalogue'
import { deriveCharacter, type ApplyInput, type CharacterDoc, type CharacterResult, type UndoInput } from '../src/server/characters'

const cat = getCatalogue()
const CENTAUR = [...cat.races.values()].find((r) => r.title === 'Centaur')!
const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

const builder: BuilderInput = {
  id: ulid(), at: new Date().toISOString(), name: 'Ysolde', pronouns: 'she/her', dream: '', description: '', motivation: '', portrait: null,
  raceId: CENTAUR.id, subraceId: null, kinChoices: {}, spelltouched: false,
  dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
  ageCategory: 'adult', ageBenefits: [], createdAspects: ['Loyal', 'Stubborn'],
  professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel: 1,
}

const derive = (c: Character) => deriveCharacter(c, cat)
function docOf(character: Character, revision: number): CharacterDoc {
  return {
    id: builder.id, ownerUserId: 'owner', campaignId: null, name: character.identity.name, revision, updatedAt: '2026-01-01T00:00:00.000Z',
    state: character, derived: derive(character), role: 'owner',
  }
}
const base = (): CharacterDoc => docOf(createCharacter(builder, cat), 7)
const character = (doc: CharacterDoc): Character => doc.state as Character

/** What the server would answer: the engine applied to `doc`, one revision on. */
function savedBy(doc: CharacterDoc, action: ClientAction): CharacterDoc {
  return docOf(applyAction(character(doc), action, cat).character, doc.revision + 1)
}

type Sent = ApplyInput
function setup(reply: (input: Sent, n: number) => Promise<CharacterResult> | CharacterResult, doc = base()) {
  const sent: Sent[] = []
  const transport: Transport = {
    apply: async (input) => { sent.push(input); return reply(input, sent.length) },
    undo: async (_input: UndoInput) => { throw new Error('unused') },
  }
  const clock = (() => { let n = 0; return () => new Date(Date.UTC(2026, 0, 1, 0, 0, n++)).toISOString() })()
  const d: Dispatcher = createDispatcher(doc, { transport, catalogue: cat, derive, now: clock })
  return { d, sent, doc }
}

/** A server that holds one document and applies what it is sent, like `applyCharacterAction`. */
function server(start = base()) {
  let current = start
  return {
    get current() { return current },
    write(action: ClientAction) { current = savedBy(current, action) },
    reply: (input: Sent): CharacterResult =>
      input.revision !== current.revision
        ? { ok: false, status: 409, code: 'conflict', message: 'changed', character: current }
        : (current = savedBy(current, input.action), { ok: true, character: current }),
  }
}
const other = (kind: ClientAction): ClientAction => ({ ...kind, id: ulid(), at: '2026-01-01T00:00:00.000Z' }) as ClientAction

const hp = (doc: CharacterDoc) => character(doc).hp.current

test('a saved change is applied on screen first, sent with the revision seen, and replaced by the server document', async () => {
  const srv = server()
  const { d, sent, doc } = setup(srv.reply, srv.current)
  const before = hp(doc)
  const pending = d.dispatch({ kind: 'damage', amount: 4 })
  assert.equal(hp(d.document()), before - 4, 'applied on screen before the server answers')
  assert.equal(d.pending(), true)
  const out = await pending
  assert.equal(out.status, 'saved')
  assert.equal(sent.length, 1)
  assert.equal(sent[0].characterId, doc.id)
  assert.equal(sent[0].revision, 7)
  assert.deepEqual(d.document(), srv.current)
  assert.equal(d.document().revision, 8)
  assert.equal(d.pending(), false)
})

test('every action sent carries its own valid ULID id and ISO at, and nothing derived travels', async () => {
  const srv = server()
  const { d, sent } = setup(srv.reply, srv.current)
  await d.dispatch({ kind: 'damage', amount: 2 })
  await d.dispatch({ kind: 'heal', amount: 1 })
  await d.dispatch({ kind: 'notes:set', notes: 'x' })
  assert.equal(sent.length, 3)
  assert.equal(new Set(sent.map((s) => s.action.id)).size, 3)
  for (const s of sent) {
    assert.match(s.action.id, ULID)
    assert.match(s.action.at, ISO)
    assert.ok(!Number.isNaN(Date.parse(s.action.at)))
    assert.deepEqual(Object.keys(s).sort(), ['action', 'characterId', 'revision'])
    assert.ok(!('derived' in s.action))
  }
})

test('the default id and clock stamp a real ULID and the current ISO time', async () => {
  const srv = server()
  const sent: Sent[] = []
  const transport: Transport = { apply: async (i) => (sent.push(i), srv.reply(i)), undo: async () => { throw new Error('unused') } }
  const d = createDispatcher(srv.current, { transport, catalogue: cat, derive })
  const t0 = Date.now()
  await d.dispatch({ kind: 'damage', amount: 1 })
  assert.match(sent[0].action.id, ULID)
  assert.match(sent[0].action.at, ISO)
  assert.ok(Math.abs(Date.parse(sent[0].action.at) - t0) < 5000)
})

test('a conflict reapplies the one in-flight action with the same id to the returned document and resubmits once', async () => {
  const srv = server()
  const { d, sent, doc } = setup(srv.reply, srv.current)
  srv.write(other({ kind: 'damage', amount: 5 } as ClientAction)) // someone else writes first: revision 8
  const out = await d.dispatch({ kind: 'damage', amount: 3 })
  assert.equal(sent.length, 2, 'sent once, resubmitted once')
  assert.deepEqual(sent[1].action, sent[0].action, 'same action id and time')
  assert.equal(sent[0].revision, 7)
  assert.equal(sent[1].revision, 8, 'resubmitted at the revision of the document the conflict returned')
  assert.ok(out.status === 'saved' && out.rebased)
  assert.equal(hp(d.document()), hp(doc) - 8, 'their 5 and our 3')
  assert.equal(d.document().revision, 9)
  assert.deepEqual(d.document(), srv.current)
})

test('a second conflict is not retried again', async () => {
  const conflicting = base()
  const { d, sent } = setup(() => ({ ok: false, status: 409, code: 'conflict', message: 'changed', character: { ...conflicting, revision: 8 } }))
  const out = await d.dispatch({ kind: 'damage', amount: 3 })
  assert.equal(sent.length, 2)
  assert.ok(out.status === 'refused' && out.code === 'conflict')
  assert.equal(d.pending(), false)
})

test('a conflict whose reapplied action the rules now refuse is not resubmitted; the other writer\'s document is shown', async () => {
  const srv = server()
  const { d, sent } = setup(srv.reply, srv.current)
  srv.write(other({ kind: 'heartDie:spend', effect: 'endure' } as ClientAction)) // they spent this round's stamina
  const out = await d.dispatch({ kind: 'heartDie:spend', effect: 'focus' })
  assert.equal(sent.length, 1, 'never resubmitted')
  assert.ok(out.status === 'refused' && out.code === 'stamina_spent')
  assert.ok(out.status === 'refused' && out.text === "Couldn't apply: the heart die was already spent this round")
  assert.deepEqual(d.document(), srv.current)
})

test('a network failure reverts to the pre-action document and reports the no-connection text', async () => {
  const { d, sent, doc } = setup(() => { throw new TypeError('fetch failed') })
  const before = d.document()
  const out = await d.dispatch({ kind: 'damage', amount: 4 })
  assert.equal(sent.length, 1, 'not retried')
  assert.ok(out.status === 'unsaved' && out.text === 'Not saved — no connection')
  assert.equal(NO_CONNECTION_TEXT, 'Not saved — no connection')
  assert.deepEqual(d.document(), before)
  assert.equal(hp(d.document()), hp(doc))
  assert.equal(d.pending(), false)
})

test('a 5xx reverts the same way', async () => {
  const { d, doc } = setup(() => ({ ok: false, status: 503, code: 'bad_input', message: 'down' }))
  const out = await d.dispatch({ kind: 'damage', amount: 4 })
  assert.ok(out.status === 'unsaved' && out.text === NO_CONNECTION_TEXT)
  assert.deepEqual(d.document(), doc)
})

test('a failed request cancels the changes queued behind it', async () => {
  const { d, sent, doc } = setup(() => { throw new TypeError('fetch failed') })
  const first = d.dispatch({ kind: 'damage', amount: 4 })
  const second = d.dispatch({ kind: 'damage', amount: 2 })
  assert.equal(hp(d.document()), hp(doc) - 6, 'both applied on screen at once')
  const [a, b] = await Promise.all([first, second])
  assert.equal(a.status, 'unsaved')
  assert.ok(b.status === 'unsaved' && b.text === FAILED_BEFORE_TEXT)
  assert.equal(sent.length, 1, 'the second was never sent')
  assert.deepEqual(d.document(), doc)
})

test('changes made while one is in flight are sent in order, each at the revision the last save returned', async () => {
  const srv = server()
  const { d, sent, doc } = setup(srv.reply, srv.current)
  const [a, b] = await Promise.all([d.dispatch({ kind: 'damage', amount: 4 }), d.dispatch({ kind: 'damage', amount: 2 })])
  assert.ok(a.status === 'saved' && b.status === 'saved')
  assert.deepEqual(sent.map((s) => s.revision), [7, 8])
  assert.equal(hp(d.document()), hp(doc) - 6)
  assert.deepEqual(d.document(), srv.current)
})

test('a server refusal returns its text and leaves the document as it was', async () => {
  const { d, doc } = setup(() => ({ ok: false, status: 422, code: 'insufficient_xp', message: 'insufficient_xp' }))
  const before = d.document()
  const out: Outcome = await d.dispatch({ kind: 'damage', amount: 4 })
  assert.ok(out.status === 'refused' && out.text === "Couldn't apply: not enough XP")
  assert.deepEqual(d.document(), before)
  assert.deepEqual(d.document(), doc)
})

test('an action the rules refuse on the current document is refused before sending', async () => {
  const { d, sent } = setup(() => { throw new Error('must not be sent') })
  const before = d.document()
  const out = await d.dispatch({ kind: 'damage', amount: -3 })
  assert.equal(sent.length, 0)
  assert.ok(out.status === 'refused' && out.code === 'invalid_amount')
  assert.deepEqual(d.document(), before)
})

test('a forbidden write is refused and reverted', async () => {
  const { d, doc } = setup(() => ({ ok: false, status: 403, code: 'forbidden', message: 'no' }))
  const out = await d.dispatch({ kind: 'heal', amount: 1 })
  assert.ok(out.status === 'refused' && out.text === "Couldn't apply: you can't edit this character")
  assert.deepEqual(d.document(), doc)
})

test('undo sends the event id, takes the server document, and a refusal reads "Couldn\'t undo"', async () => {
  const doc = base()
  const undone = docOf(createCharacter(builder, cat), 8)
  const calls: UndoInput[] = []
  let answer: CharacterResult = { ok: true, character: undone }
  const transport: Transport = { apply: async () => { throw new Error('unused') }, undo: async (i) => (calls.push(i), answer) }
  const d = createDispatcher(doc, { transport, catalogue: cat, derive })
  const out = await d.undo('EVENT')
  assert.deepEqual(calls, [{ characterId: doc.id, eventId: 'EVENT' }])
  assert.equal(out.status, 'saved')
  assert.deepEqual(d.document(), undone)
  answer = { ok: false, status: 409, code: 'not_top_of_stack', message: 'not_top_of_stack' }
  const refused = await d.undo('OLD')
  assert.ok(refused.status === 'refused' && refused.text === "Couldn't undo: only the latest change can be undone")
  assert.deepEqual(d.document(), undone)
})

test('adopt takes a newer loader document only when nothing is in flight', async () => {
  const srv = server()
  const { d, doc } = setup(srv.reply, srv.current)
  const newer = docOf(character(doc), 9)
  d.adopt(docOf(character(doc), 7))
  assert.equal(d.document().revision, 7, 'not newer: ignored')
  d.adopt(newer)
  assert.equal(d.document().revision, 9)
})

test('a draft cannot be dispatched through the sheet', () => {
  const draft: CharacterDoc = { ...base(), state: { schemaVersion: 1, draft: true, builder, pending: [] } }
  assert.throws(() => createDispatcher(draft, { transport: { apply: async () => { throw new Error() }, undo: async () => { throw new Error() } }, catalogue: cat, derive }))
})

test('refusal text covers server and engine codes in plain words', () => {
  assert.equal(refusalText('not_enough_rush'), "Couldn't apply: not enough rush points")
  assert.equal(refusalText('bad_action', 'Ability already used this period'), "Couldn't apply: ability already used this period")
  assert.equal(refusalText('invalid_amount', 'invalid_amount'), "Couldn't apply: that amount isn't allowed")
})
