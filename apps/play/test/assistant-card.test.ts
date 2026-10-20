// The creation assistant's pure core: card lines checked, applied and settled against a draft (design acceptance 1, 2, 4, 5
// node parts), and the step bar's open rule. No D1 and no runtime: everything here is `assistant/card.ts` and `draft-rules.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { BuilderInput, ClientAction } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../src/catalogue'
import { newBuilder, stepOpen, sketchPreview, type DraftContent } from '../src/components/builder/draft-rules'
import { applyCard, checkCard, lineState, settleTurn } from '../src/assistant/card'
import { turnSchema, type CardLine, type StoredLine, type Turn } from '../src/assistant/schema'

const catalogue = getCatalogue()
const CENTAUR = [...catalogue.races.values()].find((r) => r.title === 'Centaur')!
const HALFLING = [...catalogue.races.values()].find((r) => r.title === 'Halfling')!
const FIERI = HALFLING.subraces.find((s) => s.title === 'Fieri')!
const at = '2026-01-01T00:00:00.000Z'

const ysolde = (): DraftContent => ({ builder: newBuilder('01HYSOLDE', at, { name: 'Ysolde', pronouns: '', dream: '', portrait: null }), pending: [] })
const reason = 'because'
/** Example 2 of the design: a centaur with d6 Might and Agility, d4 Cunning and Presence. */
const example2: CardLine[] = [
  { kind: 'kin', raceId: CENTAUR.id, subraceId: null, reason },
  { kind: 'die', ability: 'might', die: 6, reason },
  { kind: 'die', ability: 'agility', die: 6, reason },
  { kind: 'die', ability: 'cunning', die: 4, reason },
  { kind: 'die', ability: 'presence', die: 4, reason },
]
const stamp = (lines: CardLine[], draft: DraftContent): StoredLine[] => {
  const turn: Turn = { message: 'm', decision: null, card: { lines } }
  let n = 0
  return settleTurn(turn, draft, catalogue, { newId: () => `L${++n}`, now: at }).card!.lines
}

test('example 2: the whole card is accepted on a draft that only has a name', () => {
  const checks = checkCard(example2, ysolde())
  assert.deepEqual(checks, example2.map(() => ({ ok: true })))
})

test('a line already in the draft is applied, and applying it again writes nothing', () => {
  const draft = ysolde()
  const lines = stamp(example2, draft)
  const first = applyCard(lines, draft)
  assert.equal(first.applied.length, 5)
  const after = { builder: first.builder, pending: first.pending }
  assert.deepEqual(lines.map((l) => lineState(l, after)), lines.map(() => 'applied'))
  const again = applyCard(lines, after)
  assert.equal(again.applied.length, 0)
  assert.equal(again.refused.length, 0)
  assert.equal(again.earliestStep, null)
})

test('a talent line writes exactly one xp:buy carrying the line id; builder lines go to the builder', () => {
  const draft = ysolde()
  const lines = stamp(
    [...example2, { kind: 'talent', catalogueId: 'player.talents.action-surge', attunementElement: null, reason }, { kind: 'name', text: ' Ysolde the Bold ', reason }],
    draft,
  )
  const talent = lines.find((l) => l.kind === 'talent')!
  const out = applyCard(lines, draft)
  assert.deepEqual(out.refused, [])
  assert.equal(out.pending.length, 1)
  const action = out.pending[0] as Extract<ClientAction, { kind: 'xp:buy' }>
  assert.equal(action.kind, 'xp:buy')
  assert.equal(action.id, talent.id)
  assert.equal(action.at, at)
  assert.equal(action.purchase, 'talent:combat')
  assert.equal(action.talent?.catalogueId, 'player.talents.action-surge')
  assert.equal(out.builder.raceId, CENTAUR.id)
  assert.equal(out.builder.dice.might, 6)
  assert.equal(out.builder.name, 'Ysolde the Bold')
  assert.equal(out.earliestStep, 1)
  assert.equal(lineState(talent, { builder: out.builder, pending: out.pending }), 'applied')
})

test('a talent line with no kin chosen is refused not_ready', () => {
  const [check] = checkCard([{ kind: 'talent', catalogueId: 'player.talents.action-surge', attunementElement: null, reason }], ysolde())
  assert.deepEqual(check, { ok: false, code: 'not_ready', reason: 'choose a kin first' })
})

test('a talent the draft cannot afford is refused by the engine', () => {
  const draft = ysolde()
  const lines = [
    ...example2,
    ...['action-surge', 'aggravator', 'agile'].map((id): CardLine => ({ kind: 'talent', catalogueId: `player.talents.${id}`, attunementElement: null, reason })),
  ]
  const checks = checkCard(lines, draft)
  assert.equal(checks.slice(0, 6).every((c) => c.ok), true)
  assert.equal(checks[6]!.ok, false)
  assert.equal((checks[6] as { code: string }).code, 'insufficient_xp')
})

test('the player sets Cunning to d6 after the card: Cunning is changed, Agility invalid_dice, kin, Might and Presence apply', () => {
  const draft = ysolde()
  const lines = stamp(example2, draft)
  const edited: DraftContent = { builder: { ...draft.builder, dice: { cunning: 6 } as BuilderInput['dice'] }, pending: [] }
  const out = applyCard(lines, edited)
  const by = Object.fromEntries(out.refused.map((r) => [r.line.kind === 'die' ? r.line.ability : r.line.kind, r]))
  assert.equal(by.cunning!.code, 'changed')
  assert.match(by.cunning!.reason, /now d6/)
  assert.equal(by.agility!.code, 'invalid_dice')
  assert.equal(out.refused.length, 2)
  assert.deepEqual(out.applied.map((l) => (l.kind === 'die' ? l.ability : l.kind)), ['kin', 'might', 'presence'])
  assert.equal(out.builder.raceId, CENTAUR.id)
  assert.equal(out.builder.dice.might, 6)
  assert.equal(out.builder.dice.presence, 4)
  assert.equal(out.builder.dice.cunning, 6)
  assert.equal(out.builder.dice.agility, undefined)
  assert.equal(out.earliestStep, 2)
  assert.equal(lineState(lines[3]!, edited), 'changed')
})

test('kin: unknown race and subrace are refused; a new race clears the kin choices; null subrace is allowed', () => {
  const draft = ysolde()
  const [a, b, c] = checkCard(
    [
      { kind: 'kin', raceId: 'player.kin-culture.nope', subraceId: null, reason },
      { kind: 'kin', raceId: CENTAUR.id, subraceId: 'player.kin-culture.nope~x', reason },
      { kind: 'kin', raceId: HALFLING.id, subraceId: null, reason },
    ],
    draft,
  )
  assert.equal((a as { code: string }).code, 'unknown_race')
  assert.equal((b as { code: string }).code, 'unknown_subrace')
  assert.equal(c!.ok, true)
  const withChoice: DraftContent = { builder: { ...draft.builder, raceId: HALFLING.id, subraceId: FIERI.id, kinChoices: { x: 'y' } }, pending: [] }
  const out = applyCard(stamp([{ kind: 'kin', raceId: CENTAUR.id, subraceId: null, reason }], withChoice), withChoice)
  assert.deepEqual(out.builder.kinChoices, {})
})

test('professions are checked as a set with the builder\'s own sentences; age benefits against the category', () => {
  const draft = ysolde()
  const [short, ok, badAge, goodAge, deepNoAspect] = checkCard(
    [
      { kind: 'professions', professions: [{ name: 'Smith', rank: 3 }], reason },
      { kind: 'professions', professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], reason },
      { kind: 'age', ageCategory: 'young', ageBenefits: ['fast-healer'], deepKnowledgeAspect: null, ageBenefitProfession: null, reason },
      { kind: 'age', ageCategory: 'young', ageBenefits: ['fast-healer', 'natural-learner'], deepKnowledgeAspect: null, ageBenefitProfession: null, reason },
      { kind: 'age', ageCategory: 'elderly', ageBenefits: ['deep-knowledge'], deepKnowledgeAspect: null, ageBenefitProfession: null, reason },
    ],
    draft,
  )
  assert.equal((short as { code: string }).code, 'invalid_professions')
  assert.match((short as { reason: string }).reason, /add up to 4 \(now 3\)/)
  assert.equal(ok!.ok, true)
  assert.equal((badAge as { code: string }).code, 'invalid_age_benefits')
  assert.equal(goodAge!.ok, true)
  assert.equal((deepNoAspect as { code: string }).code, 'invalid_age_benefits')
})

test('gear lines become one gear action each, with misc 0, and need a sketch character', () => {
  const draft = ysolde()
  const gear: CardLine[] = [
    { kind: 'weapon', name: 'Lance', size: 'H', damageType: 'P', attackType: 'melee', reach: true, wielded: true, reason },
    { kind: 'armor', name: 'Leather', weight: 'L', reason },
    { kind: 'shield', name: 'Buckler', weight: 'L', reason },
    { kind: 'item', name: 'Rope', slots: 1, quantity: 1, notes: '', reason },
  ]
  assert.equal(checkCard(gear, draft).every((c) => !c.ok && c.code === 'not_ready'), true)
  const withKin = { builder: { ...draft.builder, raceId: CENTAUR.id }, pending: [] }
  const out = applyCard(stamp(gear, withKin), withKin)
  assert.deepEqual(out.pending.map((a) => a.kind), ['gear:weapon:add', 'gear:armor:set', 'gear:shield:set', 'gear:item:add'])
  assert.equal(out.earliestStep, 7)
  const sketch = sketchPreview(out.builder, out.pending)!
  assert.equal(sketch.gear.weapons[0]!.name, 'Lance')
  assert.equal(sketch.gear.armor.worn, true)
})

test('settleTurn drops options with non-rules links and unknown refs, fixes catalogue links, and nulls an empty decision', () => {
  const draft = ysolde()
  const option = (over: Partial<Turn['decision'] extends infer D ? (D extends { options: (infer O)[] } ? O : never) : never>) =>
    ({ label: 'x', feel: 'f', link: 'https://rules.heartrush.party/player/kin-culture/goblin', ref: null, ...over }) as never
  const turn: Turn = {
    message: 'hi',
    decision: {
      question: 'Who?',
      seeAll: 'kin',
      options: [
        option({ label: 'ok', ref: null }),
        option({ label: 'elsewhere', link: 'https://example.com/goblin' }),
        option({ label: 'ghost race', ref: { kind: 'race', raceId: 'player.kin-culture.ghost', subraceId: null } }),
        option({ label: 'ghost subrace', ref: { kind: 'race', raceId: HALFLING.id, subraceId: 'nope' } }),
        option({ label: 'ghost talent', ref: { kind: 'talent', catalogueId: 'player.talents.ghost' } }),
        option({ label: 'wrong page', link: 'https://rules.heartrush.party/player/other', ref: { kind: 'race', raceId: CENTAUR.id, subraceId: null } }),
        option({ label: 'anchored', link: `https://rules.heartrush.party${HALFLING.path}#fieri`, ref: { kind: 'race', raceId: HALFLING.id, subraceId: FIERI.id } }),
      ],
    },
    card: null,
  }
  const out = settleTurn(turn, draft, catalogue)
  assert.deepEqual(out.decision!.options.map((o) => o.label), ['ok', 'wrong page', 'anchored'])
  assert.equal(out.decision!.options[1]!.link, `https://rules.heartrush.party${CENTAUR.path}`)
  assert.equal(out.decision!.options[2]!.link, `https://rules.heartrush.party${HALFLING.path}#fieri`)

  const none = settleTurn({ ...turn, decision: { ...turn.decision!, options: turn.decision!.options.slice(1, 5) } }, draft, catalogue)
  assert.equal(none.decision, null)
  assert.equal(none.text, 'hi')
})

test('settleTurn drops a talent option the draft cannot buy now and keeps one it can', () => {
  const draft = { builder: { ...ysolde().builder, raceId: CENTAUR.id }, pending: [] }
  const link = 'https://rules.heartrush.party/player/talents/action-surge'
  const turn: Turn = {
    message: '',
    decision: {
      question: 'q', seeAll: 'talents',
      options: [
        { label: 'Action Surge', feel: 'f', link, ref: { kind: 'talent', catalogueId: 'player.talents.action-surge' } },
        { label: 'Attraction', feel: 'f', link: 'https://rules.heartrush.party/player/spells/attraction', ref: { kind: 'talent', catalogueId: 'player.spells.attraction' } },
        { label: 'Other', feel: 'f', link, ref: null },
      ],
    },
    card: null,
  }
  const out = settleTurn(turn, draft, catalogue)
  assert.deepEqual(out.decision!.options.map((o) => o.label), ['Action Surge', 'Other'])
})

test('settleTurn drops refused lines, stamps ids and before values, and nulls an empty card', () => {
  const draft = ysolde()
  const lines: CardLine[] = [{ kind: 'name', text: 'Ysolde the Bold', reason }, { kind: 'kin', raceId: 'nope', subraceId: null, reason }, example2[1]!]
  const turn: Turn = { message: 'm', decision: null, card: { lines } }
  let n = 0
  const out = settleTurn(turn, draft, catalogue, { newId: () => `L${++n}`, now: at })
  assert.deepEqual(out.card!.lines.map((l) => [l.kind, l.id, l.before]), [['name', 'L1', 'Ysolde'], ['die', 'L2', null]])
  assert.equal(settleTurn({ ...turn, card: { lines: [lines[1]!] } }, draft, catalogue).card, null)
  const talent = settleTurn({ ...turn, card: { lines: [{ kind: 'talent', catalogueId: 'player.talents.action-surge', attunementElement: null, reason }] } }, { builder: { ...draft.builder, raceId: CENTAUR.id }, pending: [] }, catalogue, { now: at })
  assert.equal(talent.card!.lines[0]!.at, at)
  assert.equal('before' in talent.card!.lines[0]!, false)
})

test('turnSchema accepts a turn with both members null and rejects unknown line kinds', () => {
  assert.ok(turnSchema.safeParse({ message: 'x', decision: null, card: null }).success)
  assert.ok(!turnSchema.safeParse({ message: 'x', decision: null, card: { lines: [{ kind: 'coins', reason }] } }).success)
  assert.ok(!turnSchema.safeParse({ message: 'x', decision: { question: 'q', options: [], seeAll: null }, card: null }).success)
})

test('stepOpen: reachable steps, finished steps 1–5 out of order, and steps 6–7 once they hold an action', () => {
  const unnamed = newBuilder('01H', at, { name: '', pronouns: '', dream: '', portrait: null })
  const none: ClientAction[] = []
  const buy: ClientAction = { kind: 'xp:buy', purchase: 'talent:combat', talent: { catalogueId: 'player.talents.action-surge' }, id: 'a', at }
  const gear: ClientAction = { kind: 'gear:item:add', item: { name: 'Rope', slots: 1, quantity: 1, notes: '' }, id: 'b', at }
  // Nothing finished: only step 1 is open (it is the first unfinished step).
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => stepOpen(n as 1, unnamed, none)), [true, false, false, false, false, false, false])
  // A written aspect pair finishes step 5 though steps 1–4 are not: step 5 opens out of order.
  const aspects = { ...unnamed, createdAspects: ['Loyal', 'Stubborn'] as [string, string] }
  assert.equal(stepOpen(5, aspects, none), true)
  assert.equal(stepOpen(4, aspects, none), false)
  // Steps 6 and 7 open on an xp:buy or a gear action.
  assert.equal(stepOpen(6, unnamed, [buy]), true)
  assert.equal(stepOpen(7, unnamed, [buy]), false)
  assert.equal(stepOpen(7, unnamed, [gear]), true)
  // A complete builder opens everything through the first unfinished step (here step 6 is the next, 7 stays shut).
  const done: BuilderInput = {
    ...unnamed, name: 'Ysolde', raceId: CENTAUR.id, dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
    createdAspects: ['Loyal', 'Stubborn'], professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }],
  }
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => stepOpen(n as 1, done, none)), [true, true, true, true, true, true, true])
})
