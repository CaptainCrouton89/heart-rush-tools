// Ruling 8: previewDraft runs createCharacter(builder), then each pending action in order, and reports the ones the engine now refuses.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { previewDraft } from '../src/draft'
import { createCharacter } from '../src/create'
import { applyAction } from '../src/actions'
import { xpRemaining } from '../src/pricing'
import { indexById, type Catalogue, type PlayRace, type PlayTalent } from '../src/catalogue'
import { RuleError, type BuilderInput, type ClientAction, type DraftState } from '../src/types'
import { conditions } from './fixtures'

const AT = '2026-01-01T00:00:00.000Z'
const race = (title: string, over: Partial<PlayRace> = {}): PlayRace =>
  ({ id: `race:${title}`, path: `/races/${title}`, title, size: 'Medium', image: null, aspects: [], abilities: [], choices: [], subraces: [], effects: [], ...over })
const gnome = race('Gnome', { effects: [{ kind: 'cost', purchase: 'talent:*', delta: -2, where: { tradition: 'Handmagic' } }] })
const centaur = race('Centaur')
const talent: PlayTalent = { id: 'talent:glimmer', path: '/t', title: 'Glimmer', category: 'combat', frequency: 'major', tradition: 'Handmagic', elements: [], body: '', destiny: null }
const catalogue: Catalogue = { races: indexById([gnome, centaur]), talents: indexById([talent]), conditions }

const builder = (over: Partial<BuilderInput> = {}): BuilderInput => ({
  id: '01DRAFT', at: AT, name: 'Pip', pronouns: '', dream: '', description: '', motivation: '', portrait: null,
  raceId: gnome.id, subraceId: null, kinChoices: {}, dice: { might: 6, agility: 4, cunning: 6, presence: 4 },
  ageCategory: 'adult', ageBenefits: [], createdAspects: ['Brave', 'Curious'],
  professions: [{ name: 'Scout', rank: 3 }, { name: 'Herbalist', rank: 1 }], bloodmarkLevel: 0, ...over,
})
const buy = (id: string): ClientAction => ({
  id, at: AT, kind: 'xp:buy', purchase: 'talent:combat',
  talent: { catalogueId: talent.id },
})
const draft = (b: BuilderInput, pending: ClientAction[]): DraftState => ({ schemaVersion: 1, draft: true, builder: b, pending })

const aspect = (id: string): ClientAction => ({ id, at: AT, kind: 'xp:buy', purchase: 'aspect:new', aspectText: `Aspect ${id}` })

describe('previewDraft', () => {
  // Starting XP at bloodmark level 0 is 5. Three new aspects cost 1 each. The Handmagic talent costs 3 − 2 = 1 for a Gnome and 3 for a Centaur.
  const pending = [aspect('A1'), aspect('A2'), aspect('A3'), buy('B1')]

  test('a Gnome draft with a pending Handmagic talent bought at 1 XP is valid and leaves 1 XP', () => {
    const r = previewDraft(draft(builder(), pending), catalogue)
    assert.deepEqual(r.invalid, [])
    const talentBuy = r.character.xp.purchases.find(p => p.id === 'B1:0')
    assert.deepEqual([talentBuy?.kind, talentBuy?.cost], ['talent:combat', 1])
    assert.equal(xpRemaining(r.character), 1)
    assert.equal(r.character.talents.find(t => t.id === 'B1:1')?.titleSnapshot, 'Glimmer')
  })

  test('edited to Centaur, the talent costs 3, exceeds the remaining 2 XP and is marked invalid with its refusal; the other actions still apply', () => {
    const r = previewDraft(draft(builder({ raceId: centaur.id }), pending), catalogue)
    assert.deepEqual(r.invalid.map(x => [x.actionId, x.error.code]), [['B1', 'insufficient_xp']])
    assert.equal(r.character.aspects.filter(a => a.source === 'purchased').length, 3)
    assert.equal(r.character.talents.some(t => t.id === 'B1:1'), false)
    assert.equal(xpRemaining(r.character), 2)
  })

  test('an invalid action leaves no trace: the next pending action runs on the state without it', () => {
    // The Centaur cannot afford the talent (3 > 2), but a following 1 XP aspect still can.
    const r = previewDraft(draft(builder({ raceId: centaur.id }), [aspect('A1'), aspect('A2'), aspect('A3'), buy('B1'), aspect('A4')]), catalogue)
    assert.deepEqual(r.invalid.map(x => x.actionId), ['B1'])
    assert.equal(r.character.aspects.some(a => a.id === 'A4:1'), true)
    assert.equal(xpRemaining(r.character), 1)
  })

  test('with no pending actions it is exactly createCharacter(builder)', () => {
    const b = builder()
    assert.deepEqual(previewDraft(draft(b, []), catalogue), { character: createCharacter(b, catalogue), invalid: [] })
  })

  test('the result equals applying each valid pending action in order (finishDraft replays the same events)', () => {
    const b = builder()
    let c = createCharacter(b, catalogue)
    for (const a of pending) c = applyAction(c, a, catalogue).character
    assert.deepEqual(previewDraft(draft(b, pending), catalogue).character, c)
  })

  test('is deterministic and does not mutate the draft', () => {
    const d = draft(builder({ raceId: centaur.id }), pending)
    const frozen = JSON.stringify(d)
    assert.deepEqual(previewDraft(d, catalogue), previewDraft(d, catalogue))
    assert.equal(JSON.stringify(d), frozen)
  })

  test('a restore or undo smuggled into pending is marked invalid with bad_action (INV-INTERNAL)', () => {
    const smuggled = { id: 'R1', at: AT, kind: 'restore', slices: { xp: { awarded: 9999, purchases: [] } } } as unknown as ClientAction
    const r = previewDraft(draft(builder(), [smuggled]), catalogue)
    assert.deepEqual(r.invalid.map(x => [x.actionId, x.error.code]), [['R1', 'bad_action']])
    assert.equal(r.character.xp.awarded, 5)
  })

  test('an invalid builder is a refusal of createCharacter, not an invalid row', () => {
    assert.throws(() => previewDraft(draft(builder({ raceId: 'missing' }), []), catalogue), (e: unknown) => e instanceof RuleError && e.code === 'unknown_race')
  })
})
