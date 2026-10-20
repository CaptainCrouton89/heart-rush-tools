// The builder's draft saver (`createDraftSaver`) against the real `saveDraft` on local D1: two savers on one draft are
// two browser tabs. A conflict must reapply only this tab's unsaved changes on top of the other tab's draft.
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ulid } from 'ulid'
import type { BuilderInput, ClientAction, DraftState } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../src/catalogue'
import { createDraft, getCharacter, saveDraft, type CharacterDoc, type CharacterResult } from '../src/server/characters'
import { createDraftSaver, type DraftSaver } from '../src/components/builder/use-draft'
import { NO_CONNECTION_TEXT } from '../src/components/sheet/refusal-text'
import { openPlayDbs, type D1 } from './db'

let t: Awaited<ReturnType<typeof openPlayDbs>>
let db: D1
before(async () => {
  t = await openPlayDbs()
  db = t.DB
})
after(() => t.dispose())
beforeEach(async () => {
  await db.prepare('DELETE FROM character').run()
  await db.prepare('DELETE FROM user').run()
  await db.prepare("INSERT INTO user (id, display_name) VALUES ('owner', 'owner')").run()
})

const CENTAUR = [...getCatalogue().races.values()].find((r) => r.title === 'Centaur')!
const at = () => new Date().toISOString()
const builder = (): BuilderInput => ({
  id: ulid(), at: at(), name: 'Ysolde', pronouns: 'she/her', dream: '', description: '', motivation: '', portrait: null,
  raceId: CENTAUR.id, subraceId: null, kinChoices: {},
  dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
  ageCategory: 'adult', ageBenefits: [], createdAspects: ['Loyal', 'Stubborn'],
  professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel: 0,
})
const addItem = (name: string): ClientAction => ({ kind: 'gear:item:add', item: { name, slots: 1, quantity: 1, notes: '' }, id: ulid(), at: at() })

function ok(result: CharacterResult): CharacterDoc {
  assert.ok(result.ok, `expected success, got ${JSON.stringify(result.ok ? null : { ...result, character: undefined })}`)
  return result.character
}
const stored = async (id: string): Promise<DraftState> => ok(await getCharacter(db, 'owner', { characterId: id })).state as DraftState

/** A tab: a saver over the draft as the page loaded it, saving through the real `saveDraft`. */
const savers: DraftSaver[] = []
function tab(doc: CharacterDoc, transport?: (input: Parameters<typeof saveDraft>[2]) => Promise<unknown>): DraftSaver {
  const s = createDraftSaver(doc, transport ?? ((input) => saveDraft(db, 'owner', input)))
  savers.push(s)
  return s
}
after(() => { for (const s of savers) s.dispose() })

test('a conflict keeps the other tab\'s change and reapplies only this tab\'s unsaved change on top', async () => {
  const doc = ok(await createDraft(db, 'owner', { builder: builder() }))
  const a = tab(doc)
  const b = tab(doc)

  // Tab B changes the dream and buys an item; it saves first.
  b.edit((d) => ({ ...d, builder: { ...d.builder, dream: 'Found a free city' } }))
  b.edit((d) => ({ ...d, pending: [...d.pending, addItem('Rope')] }))
  assert.ok(await b.flush())

  // Tab A, still on the draft as first loaded, edits an unrelated field. Its save conflicts and is reapplied on B's draft.
  a.edit((d) => ({ ...d, builder: { ...d.builder, pronouns: 'they/them' } }))
  const saved = await a.flush()
  assert.ok(saved, 'saved after the conflict')

  const state = await stored(doc.id)
  assert.equal(state.builder.dream, 'Found a free city', 'tab B\'s dream is kept')
  assert.deepEqual(state.pending.map((p) => p.kind === 'gear:item:add' && p.item.name), ['Rope'], 'tab B\'s purchase is kept')
  assert.equal(state.builder.pronouns, 'they/them', 'tab A\'s change is applied')
  assert.equal(saved.revision, 3)
  // Tab A's screen now shows the merged draft.
  const shown = a.snapshot()
  assert.equal(shown.builder.dream, 'Found a free city')
  assert.equal(shown.pending.length, 1)
  assert.equal(shown.revision, 3)
  assert.equal(shown.status.kind, 'saved')
  assert.equal(a.dirty(), false)
})

test('a change made while a save is in flight is kept and saved next', async () => {
  const doc = ok(await createDraft(db, 'owner', { builder: builder() }))
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  let calls = 0
  const a = tab(doc, async (input) => {
    if (calls++ === 0) await gate
    return saveDraft(db, 'owner', input)
  })
  a.edit((d) => ({ ...d, builder: { ...d.builder, dream: 'One' } }))
  const first = a.flush()
  a.edit((d) => ({ ...d, builder: { ...d.builder, pronouns: 'he/him' } }))
  release()
  await first
  await a.flush()
  const state = await stored(doc.id)
  assert.equal(state.builder.dream, 'One')
  assert.equal(state.builder.pronouns, 'he/him')
  assert.equal(a.dirty(), false)
})

test('a failed save keeps the change unsaved on screen and the next flush sends it', async () => {
  const doc = ok(await createDraft(db, 'owner', { builder: builder() }))
  let down = true
  const a = tab(doc, async (input) => {
    if (down) throw new Error('offline')
    return saveDraft(db, 'owner', input)
  })
  a.edit((d) => ({ ...d, builder: { ...d.builder, dream: 'Kept' } }))
  assert.equal(await a.flush(), null)
  assert.deepEqual(a.snapshot().status, { kind: 'failed', text: NO_CONNECTION_TEXT })
  assert.equal(a.dirty(), true)
  assert.equal(a.snapshot().builder.dream, 'Kept')
  down = false
  assert.ok(await a.flush())
  assert.equal((await stored(doc.id)).builder.dream, 'Kept')
})
