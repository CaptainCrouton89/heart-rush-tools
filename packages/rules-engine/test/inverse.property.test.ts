// Criterion 15 (inverses and the undo stack), spec criterion 21's undo half, INV-INTERNAL and INV-DET for applyAction.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { applyAction, applyInverse, canUndo, upgradeCharacter, type UndoableEvent } from '../src/actions'
import { xpRemaining } from '../src/pricing'
import { ELEMENTAL_AFFINITY_ID, indexById, type PlayTalent } from '../src/catalogue'
import { RuleError, type ActionBody, type Character, type ClientAction, type Inverse } from '../src/types'
import { SLEEP_EACH, suffocationStep } from '../src/reducers/combat'
import { conditions, makeCharacter } from './fixtures'

const AT = '2026-01-01T00:00:00.000Z'
const entry = (id: string, category: PlayTalent['category'], over: Partial<PlayTalent> = {}): PlayTalent =>
  ({ id, path: `/t/${id}`, title: id, category, frequency: 'major', tradition: null, elements: [], body: '', destiny: null, ...over })
const TALENTS = {
  combat: entry('t:combat', 'combat', { tradition: 'Handmagic' }),
  noncombat: entry('t:noncombat', 'noncombat', { frequency: null }),
  affinity: entry(ELEMENTAL_AFFINITY_ID, 'noncombat', { frequency: 'passive' }),
  spell: entry('t:spell', 'elemental', { elements: ['fire'], attunementLevel: 'basic' }),
}
const catalogue = { conditions, talents: indexById(Object.values(TALENTS)) }
type Body = Exclude<ActionBody, { kind: 'restore' | 'undo' }>
const stamp = (body: Body, id: string): ClientAction => ({ id, at: AT, ...body }) as ClientAction

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o) }
  return o
}
const refuses = (code: string, fn: () => unknown) =>
  assert.throws(fn, (e: unknown) => e instanceof RuleError && e.code === code, `expected RuleError(${code})`)

// ---- generators: random valid states ---------------------------------------------------------

const int = (min: number, max: number) => fc.integer({ min, max })
const pick = <T>(xs: readonly T[]) => fc.constantFrom(...xs)
const maybe = <T>(a: fc.Arbitrary<T>) => fc.option(a, { nil: undefined })
const idOf = (xs: readonly { id: string }[]) => xs.length ? pick(xs.map(x => x.id)) : fc.constant('missing')

const CONDITION_IDS = [...conditions.keys()]
const DICE = [4, 6, 8, 10, 12] as const
const HEART = [4, 6, 8, 10, 12, 20] as const

const talentArb = (i: number) => fc.record({
  category: pick(['combat', 'noncombat', 'elemental', 'racial', 'custom'] as const),
  frequency: pick(['passive', 'minor', 'major', 'weekly', 'monthly'] as const),
  destiny: fc.boolean(), usedThisPeriod: fc.boolean(), usesThisFight: int(0, 3),
}).map(r => ({ id: `t${i}`, catalogueId: null, titleSnapshot: `Talent ${i}`, customText: null, ...r }))

const conditionArb = (i: number) => fc.oneof(
  fc.record({ conditionId: pick(CONDITION_IDS), level: fc.oneof(int(1, 3), fc.constant(null)), permanent: fc.boolean(), source: pick(['sleep', 'manual'] as const) })
    .map(r => ({ id: `k${i}`, name: null, affects: [], ...r })),
  fc.record({ level: int(1, 3), permanent: fc.boolean(), affects: fc.subarray(['might', 'agility', 'cunning', 'presence'] as const) })
    .map(r => ({ id: `k${i}`, conditionId: null, name: 'Cursed', source: 'manual' as const, ...r })),
)

const professionArb = (i: number) => fc.oneof(
  fc.record({ rank: int(0, 7), challenges: int(0, 12), missions: int(0, 1), practiceWeeks: int(0, 60) }),
  fc.constant({ rank: 2, challenges: 4, missions: 1, practiceWeeks: 9 }),
).map(r => ({ id: `p${i}`, name: `Profession ${i}`, rerollOnes: false, ...r }))

const list = <T>(item: (i: number) => fc.Arbitrary<T>, max: number) =>
  int(0, max).chain(n => fc.tuple(...Array.from({ length: n }, (_, i) => item(i))) as fc.Arbitrary<T[]>)

const RACE_EFFECTS: Character['raceEffects'] = [
  { kind: 'cost', purchase: 'hp', delta: 1 },
  { kind: 'awardBonus', per: 7, bonus: 1 },
  { kind: 'dieCap', ability: 'might', max: 6 },
  { kind: 'cost', purchase: 'talent:*', delta: -2, where: { tradition: 'Handmagic' } },
  { kind: 'aspectRankCap', max: 8 },
]

const characterArb: fc.Arbitrary<Character> = fc.record({
  abilities: fc.tuple(...(['might', 'agility', 'cunning', 'presence'] as const).map(() => fc.tuple(pick([4, 6] as const), int(0, 4)))),
  baseMax: pick([25, 40, 50]),
  hpPurchases: int(0, 3),
  extraXp: fc.oneof(int(0, 60), int(200, 1100)),
  heartDie: pick(HEART),
  hpOffset: int(-10, 0),
  wounds: list(i => fc.record({ rank: int(1, 12), treated: fc.boolean() }).map(r => ({ id: `w${i}`, description: '', takenAt: AT, ...r })), 3),
  conditions: list(conditionArb, 3),
  aspects: list(i => fc.record({ rank: int(1, 5), honor: fc.boolean() }).map(r => ({ id: `a${i}`, text: `Aspect ${i}`, source: 'created' as const, ...r })), 3),
  professions: list(professionArb, 2),
  talents: list(talentArb, 4),
  weapons: list(i => fc.record({ size: pick(['H', 'L', 'UL'] as const), damageType: pick(['B', 'S', 'P'] as const), misc: int(0, 2), wielded: fc.boolean() })
    .map(r => ({ id: `g${i}`, name: `Weapon ${i}`, attackType: 'melee' as const, reach: false, ...r, wielded: r.wielded && i === 0 })), 2),
  armor: fc.record({ weight: pick(['H', 'M', 'L', 'none'] as const), misc: int(0, 2), worn: fc.boolean() }),
  items: list(i => fc.record({ slots: int(0, 3), quantity: int(1, 4) }).map(r => ({ id: `i${i}`, name: `Item ${i}`, notes: '', ...r })), 2),
  effects: fc.subarray(RACE_EFFECTS),
  attunements: fc.subarray<Character['attunements'][number]>([
    { id: 'at0', element: 'fire', level: 'basic', source: 'race' }, { id: 'at1', element: 'water', level: 'advanced', source: 'talent' },
  ]),
  bloodmarkLevel: int(0, 6),
  hasBloodmark: fc.boolean(),
  path: fc.oneof(fc.constant(null), int(1, 3).map(tier => ({ pathId: 'path:vampire', tier: tier as 1 | 2 | 3 }))),
  play: fc.record({ round: int(1, 5), rushPoints: int(0, 6), dp: int(0, 10), staminaSpentRound: fc.oneof(fc.constant(null), int(1, 5)), failedRestStreak: int(0, 3), youngAndFoolish: fc.boolean() }),
}).map(r => {
  const dice = r.abilities.map(([start, steps]) => ({ start, current: Math.min(12, start + 2 * steps) as 4 | 6 | 8 | 10 | 12 }))
  const purchases = Array.from({ length: r.hpPurchases }, (_, i) => ({ id: `pu${i}`, kind: 'hp' as const, target: null, cost: i + 5, at: AT }))
  const spent = purchases.reduce((s, p) => s + p.cost, 0)
  const awarded = spent + r.extraXp
  const max = r.baseMax + 10 * r.hpPurchases
  const heart = [...HEART].filter(h => h <= (awarded >= 1000 ? 20 : awarded >= 500 ? 12 : awarded >= 200 ? 10 : 8)).includes(r.heartDie) ? r.heartDie : 6
  return makeCharacter({
    abilities: { might: dice[0]!, agility: dice[1]!, cunning: dice[2]!, presence: dice[3]! },
    hp: { baseMax: r.baseMax, current: max + r.hpOffset, heartDieCurrent: heart },
    wounds: r.wounds, conditions: r.conditions, aspects: r.aspects, professions: r.professions, talents: r.talents,
    gear: {
      weapons: r.weapons, armor: { name: '', ...r.armor }, shield: { name: '', weight: 'none', misc: 0, worn: false },
      items: r.items, coins: { iron: 0, obol: 0, lire: 0, ducat: 0, crown: 0 },
    },
    xp: { awarded, purchases },
    raceEffects: r.effects, attunements: r.attunements,
    bloodmarks: { level: r.bloodmarkLevel, abilities: r.hasBloodmark && r.bloodmarkLevel >= 1 ? [{ id: 'b0', kind: 'specialization', title: 'S', text: '', grantedAtLevel: 1 }] : [] },
    path: r.path,
    play: { ...makeCharacter().play, ...r.play },
  })
})

const WOUND_NAMES = ['weakened', 'off-balanced', 'dazed'] as const

/** One arbitrary per action kind, built from the character so ids resolve; the reducer still refuses some. */
function bodies(c: Character): Array<fc.Arbitrary<Body>> {
  const ability = pick(['might', 'agility', 'cunning', 'presence'] as const)
  const level = fc.oneof(fc.constant(null), int(0, 6))
  const night = c.play.failedRestStreak + 1
  const rolled = night >= 3 ? fc.constant(Array.from(SLEEP_EACH)) : fc.array(pick(WOUND_NAMES), { minLength: night, maxLength: night })
  const customRows = c.conditions.filter(k => k.conditionId === null)
  const buy = (purchase: Extract<Body, { kind: 'xp:buy' }>['purchase'], rest: fc.Arbitrary<Partial<Extract<Body, { kind: 'xp:buy' }>>> = fc.constant({})) =>
    rest.map(r => ({ kind: 'xp:buy', purchase, ...r }) as Body)
  return [
    int(1, 25).chain(amount => maybe(fc.string({ maxLength: 8 })).map(woundDescription => ({ kind: 'damage', amount, woundDescription }) as Body)),
    int(1, 30).map(amount => ({ kind: 'heal', amount })),
    int(-10, 60).map(value => ({ kind: 'setHp', value })),
    fc.record({ rank: int(1, 12), description: fc.string({ maxLength: 8 }) }).map(wound => ({ kind: 'wound:add', wound })),
    fc.tuple(idOf(c.wounds), int(1, 12), fc.boolean()).map(([id, rank, treated]) => ({ kind: 'wound:edit', wound: { id, rank, treated } })),
    idOf(c.wounds).map(woundId => ({ kind: 'wound:remove', woundId })),
    fc.tuple(idOf(c.wounds), int(0, 14)).map(([woundId, medicineRoll]) => ({ kind: 'wound:treat', woundId, medicineRoll })),
    fc.tuple(pick(CONDITION_IDS), level, maybe(fc.boolean())).map(([conditionId, level, permanent]) => ({ kind: 'condition:set', conditionId, level, permanent })),
    fc.tuple(int(1, 5), ability).map(([level, a]) => ({ kind: 'condition:custom', custom: { name: 'Hexed', affects: [a] }, level })),
    fc.tuple(idOf(customRows), int(0, 5), fc.boolean()).map(([rowId, level, permanent]) => ({ kind: 'condition:custom', rowId, level, permanent })),
    idOf(c.talents).map(talentId => ({ kind: 'ability:use', talentId })),
    idOf(c.talents).map(talentId => ({ kind: 'ability:reset', talentId })),
    int(0, 10).map(value => ({ kind: 'rush:set', value })),
    int(-2, 12).map(value => ({ kind: 'dp:set', value })),
    int(1, 9).map(value => ({ kind: 'round:set', value })),
    pick(['endure', 'focus', 'surge'] as const).map(effect => ({ kind: 'heartDie:spend', effect })),
    pick(HEART).map(value => ({ kind: 'heartDie:set', value })),
    fc.boolean().map(one => ({ kind: 'nextRound', suffocation: suffocationStep(c, one) })),
    fc.constant({ kind: 'endFight' }),
    fc.constant({ kind: 'shortRest' }),
    fc.constant({ kind: 'longRest', successful: true }),
    rolled.map(rolled => ({ kind: 'longRest', successful: false, rolled })),
    fc.constant({ kind: 'startSession' }),
    int(1, 40).map(amount => ({ kind: 'xp:award', amount })),
    buy('hp'),
    ability.chain(a => buy('die', fc.constant({ target: { ability: a } }))),
    buy('aspect:new', fc.constant({ aspectText: 'New aspect' })),
    idOf(c.aspects).chain(aspectId => buy('aspect:rank', fc.constant({ target: { aspectId } }))),
    buy('talent:combat', fc.constant({ talent: { catalogueId: TALENTS.combat.id } })),
    buy('talent:noncombat', fc.constant({ talent: { catalogueId: TALENTS.noncombat.id } })),
    buy('talent:noncombat', fc.constant({ talent: { catalogueId: TALENTS.affinity.id, attunementElement: 'fire' } })),
    buy('talent:elemental', fc.constant({ talent: { catalogueId: TALENTS.spell.id } })),
    idOf(c.talents).chain(talentId => buy('destiny', fc.constant({ target: { talentId } }))),
    buy('path', fc.constant({ target: { pathId: 'path:vampire' } })),
    buy('path:tier'),
    fc.constant({ kind: 'bloodmark:award' }),
    pick(['specialization', 'signature', 'mastery', 'paragon'] as const).map(kind => ({ kind: 'bloodmark:pick', ability: { kind, title: 'Picked', text: '' } })),
    fc.record({ size: pick(['H', 'L', 'UL'] as const), damageType: pick(['B', 'S', 'P'] as const), misc: int(0, 2), wielded: fc.boolean() })
      .map(r => ({ kind: 'gear:weapon:add', weapon: { name: 'Sword', attackType: 'melee', reach: false, ...r } })),
    fc.tuple(idOf(c.gear.weapons), int(0, 3), fc.boolean()).map(([id, misc, wielded]) => ({ kind: 'gear:weapon:edit', weapon: { id, misc, wielded } })),
    idOf(c.gear.weapons).map(weaponId => ({ kind: 'gear:weapon:remove', weaponId })),
    fc.oneof(fc.constant(null), idOf(c.gear.weapons)).map(weaponId => ({ kind: 'gear:wield', weaponId })),
    fc.record({ weight: pick(['H', 'M', 'L', 'none'] as const), misc: int(0, 3), worn: fc.boolean() }).map(armor => ({ kind: 'gear:armor:set', armor })),
    fc.record({ weight: pick(['H', 'L', 'none'] as const), misc: int(0, 3), worn: fc.boolean() }).map(shield => ({ kind: 'gear:shield:set', shield })),
    fc.tuple(pick(['armor', 'shield'] as const), fc.boolean()).map(([piece, worn]) => ({ kind: 'gear:wear', piece, worn })),
    fc.record({ slots: int(0, 3), quantity: int(1, 4) }).map(r => ({ kind: 'gear:item:add', item: { name: 'Rope', notes: '', ...r } })),
    fc.tuple(idOf(c.gear.items), int(1, 9)).map(([id, quantity]) => ({ kind: 'gear:item:edit', item: { id, quantity } })),
    idOf(c.gear.items).map(itemId => ({ kind: 'gear:item:remove', itemId })),
    int(0, 50).map(iron => ({ kind: 'gear:coins:set', coins: { iron } })),
    fc.tuple(idOf(c.aspects), fc.boolean()).map(([id, honor]) => ({ kind: 'aspect:edit', aspect: { id, text: 'Edited', honor } })),
    idOf(c.aspects).map(aspectId => ({ kind: 'aspect:remove', aspectId })),
    fc.tuple(idOf(c.aspects), int(0, 6)).map(([aspectId, dp]) => ({ kind: 'aspect:invoke', aspectId, dp })),
    idOf(c.aspects).map(aspectId => ({ kind: 'aspect:hinder', aspectId })),
    int(0, 7).map(rank => ({ kind: 'profession:add', profession: { name: 'Smith', rank } })),
    fc.tuple(idOf(c.professions), int(0, 7)).map(([id, rank]) => ({ kind: 'profession:edit', profession: { id, rank } })),
    idOf(c.professions).map(professionId => ({ kind: 'profession:remove', professionId })),
    idOf(c.professions).map(professionId => ({ kind: 'profession:challenge', professionId })),
    idOf(c.professions).map(professionId => ({ kind: 'profession:practice', professionId })),
    fc.tuple(idOf(c.professions), fc.boolean()).map(([professionId, done]) => ({ kind: 'profession:mission', professionId, done })),
    idOf(c.professions).map(professionId => ({ kind: 'profession:advance', professionId })),
    fc.string({ maxLength: 8 }).map(name => ({ kind: 'identity:set', identity: { name } })),
    fc.string({ maxLength: 20 }).map(notes => ({ kind: 'notes:set', notes })),
    fc.subarray(RACE_EFFECTS).map(effects => ({ kind: 'raceEffects:set', effects })),
    fc.subarray<Character['attunements'][number]>([{ id: 'x0', element: 'air', level: 'basic', source: 'race' }]).map(attunements => ({ kind: 'attunement:set', attunements })),
  ]
}

const actionFor = (c: Character, id: string): fc.Arbitrary<ClientAction> => fc.oneof(...bodies(c)).map(b => stamp(b, id))

/** Every client action kind; adding a kind to the union fails the build here until a generator covers it. */
const ALL_KINDS: Record<Body['kind'], true> = {
  'damage': true, 'heal': true, 'setHp': true, 'wound:add': true, 'wound:edit': true, 'wound:remove': true, 'wound:treat': true,
  'condition:set': true, 'condition:custom': true, 'ability:use': true, 'ability:reset': true, 'rush:set': true, 'dp:set': true, 'round:set': true,
  'heartDie:spend': true, 'heartDie:set': true, 'nextRound': true, 'endFight': true, 'shortRest': true, 'longRest': true, 'startSession': true,
  'xp:award': true, 'xp:buy': true, 'bloodmark:award': true, 'bloodmark:pick': true,
  'gear:weapon:add': true, 'gear:weapon:edit': true, 'gear:weapon:remove': true, 'gear:wield': true, 'gear:armor:set': true,
  'gear:shield:set': true, 'gear:wear': true, 'gear:item:add': true, 'gear:item:edit': true, 'gear:item:remove': true, 'gear:coins:set': true,
  'aspect:edit': true, 'aspect:remove': true, 'aspect:invoke': true, 'aspect:hinder': true, 'profession:add': true, 'profession:edit': true, 'profession:remove': true,
  'profession:challenge': true, 'profession:practice': true, 'profession:mission': true, 'profession:advance': true,
  'identity:set': true, 'notes:set': true, 'raceEffects:set': true, 'attunement:set': true,
}

const tryApply = (c: Character, a: ClientAction) => {
  try { return applyAction(c, a, catalogue) } catch (e) { if (e instanceof RuleError) return e; throw e }
}

describe('criterion 15: inverse restores the original state', () => {
  const succeeded = new Map<string, number>()
  const params = { numRuns: 6000, seed: 20261020 }

  test('property: any action that succeeds is undone exactly by its inverse (inputs frozen, so a reducer that mutates fails)', () => {
    fc.assert(fc.property(characterArb.chain(c => actionFor(c, 'A1').map(a => [c, a] as const)), ([c, a]) => {
      deepFreeze(c)
      const r = tryApply(c, a)
      if (r instanceof RuleError) return
      succeeded.set(a.kind, (succeeded.get(a.kind) ?? 0) + 1)
      assert.equal(r.inverse.kind, 'restore')
      const undone = applyInverse(r.character, r.inverse)
      assert.deepEqual(undone.character, c)
    }), params)
  })

  test('the property reached every action kind with at least one accepted action', () => {
    const missing = Object.keys(ALL_KINDS).filter(k => !succeeded.get(k))
    assert.deepEqual(missing, [])
  })

  test('property: a sequence of up to four accepted actions is undone newest first back to the original', () => {
    const sequence = (c: Character, n: number): fc.Arbitrary<ClientAction[]> => n === 0 ? fc.constant([]) :
      actionFor(c, `S${n}`).chain(a => {
        const r = tryApply(c, a)
        return r instanceof RuleError ? fc.constant([]) : sequence(r.character, n - 1).map(rest => [a, ...rest])
      })
    fc.assert(fc.property(characterArb.chain(c => sequence(c, 4).map(actions => [c, actions] as const)), ([start, actions]) => {
      let c = start
      const inverses: Inverse[] = []
      for (const a of actions) {
        const r = applyAction(c, a, catalogue)
        inverses.push(r.inverse)
        c = r.character
      }
      for (const inverse of inverses.reverse()) c = applyInverse(c, inverse).character
      assert.deepEqual(c, start)
    }), { numRuns: 1500, seed: 20261020 })
  })
})

describe('INV-DET: determinism', () => {
  test('property: applying any action twice from the same state gives deep-equal results (or the same refusal)', () => {
    fc.assert(fc.property(characterArb.chain(c => actionFor(c, 'A1').map(a => [c, a] as const)), ([c, a]) => {
      const first = tryApply(c, a)
      const second = tryApply(c, a)
      if (first instanceof RuleError || second instanceof RuleError) {
        assert.ok(first instanceof RuleError && second instanceof RuleError && first.code === second.code)
      } else {
        assert.deepEqual(second, first)
      }
    }), { numRuns: 3000, seed: 20261020 })
  })
})

describe('INV-INTERNAL: restore and undo are never accepted as client actions', () => {
  test('applyAction refuses restore, undo and unknown kinds with bad_action', () => {
    const c = makeCharacter()
    refuses('bad_action', () => applyAction(c, { id: 'R', at: AT, kind: 'restore', slices: { notes: 'x' } } as never, catalogue))
    refuses('bad_action', () => applyAction(c, { id: 'U', at: AT, kind: 'undo', of: 'A' } as never, catalogue))
    refuses('bad_action', () => applyAction(c, { id: 'X', at: AT, kind: 'nope' } as never, catalogue))
  })
  test('applyInverse refuses a slice that is not a stored character field', () => {
    refuses('bad_action', () => applyInverse(makeCharacter(), { kind: 'restore', slices: { draft: true } as never }))
    refuses('bad_action', () => applyInverse(makeCharacter(), { kind: 'restore', slices: { hacked: 1 } as never }))
  })
})

describe('inverse content (ruling 7)', () => {
  test('holds the previous value of exactly the top-level keys the action changed', () => {
    const c = makeCharacter()
    assert.deepEqual(Object.keys(applyAction(c, stamp({ kind: 'damage', amount: 5 }, 'D1'), catalogue).inverse.slices), ['hp'])
    const wounded = applyAction(c, stamp({ kind: 'damage', amount: 12, woundDescription: 'leg' }, 'D2'), catalogue)
    assert.deepEqual(Object.keys(wounded.inverse.slices).sort(), ['hp', 'wounds'])
    assert.deepEqual(wounded.inverse.slices, { hp: c.hp, wounds: c.wounds })
    assert.deepEqual(applyAction(c, stamp({ kind: 'notes:set', notes: '' }, 'N1'), catalogue).inverse.slices, {})
  })
  test('the inverse of an inverse restores the post-action state', () => {
    const c = makeCharacter()
    const first = applyAction(c, stamp({ kind: 'damage', amount: 12 }, 'D1'), catalogue)
    const undone = applyInverse(first.character, first.inverse)
    assert.deepEqual(applyInverse(undone.character, undone.inverse).character, first.character)
  })
})

describe('criterion 15: the undo stack', () => {
  const event = (id: string, seq: number, kind: UndoableEvent['kind'], undone = false): UndoableEvent => ({ id, seq, kind, undone })

  test('d4→d6→d8: the older purchase is refused, the newer is undone to d6 with its XP back, then the older to d4', () => {
    const start = makeCharacter({ xp: { awarded: 30, purchases: [] } })
    const buy = (id: string) => stamp({ kind: 'xp:buy', purchase: 'die', target: { ability: 'agility' } }, id)
    const one = applyAction(start, buy('E1'), catalogue)
    const two = applyAction(one.character, buy('E2'), catalogue)
    assert.equal(two.character.abilities.agility.current, 8)
    assert.equal(xpRemaining(two.character), 30 - 6 - 8)

    let events = [event('E1', 1, 'xp:buy'), event('E2', 2, 'xp:buy')]
    refuses('not_top_of_stack', () => canUndo(events, 'E1'))
    assert.equal(canUndo(events, 'E2').id, 'E2')

    const undoTwo = applyInverse(two.character, two.inverse)
    assert.equal(undoTwo.character.abilities.agility.current, 6)
    assert.equal(xpRemaining(undoTwo.character), 30 - 6)

    // The undo is itself an event; E2 is marked undone. Neither the undone event nor the undo event is offered.
    events = [event('E1', 1, 'xp:buy'), event('E2', 2, 'xp:buy', true), event('U1', 3, 'undo')]
    refuses('not_top_of_stack', () => canUndo(events, 'E2'))
    refuses('not_top_of_stack', () => canUndo(events, 'U1'))
    assert.equal(canUndo(events, 'E1').id, 'E1')

    const undoOne = applyInverse(undoTwo.character, one.inverse)
    assert.equal(undoOne.character.abilities.agility.current, 4)
    assert.deepEqual(undoOne.character, start)
  })

  test('canUndo orders by seq, not array position, and names an unknown event', () => {
    const events = [event('E2', 2, 'damage'), event('E1', 1, 'damage')]
    assert.equal(canUndo(events, 'E2').id, 'E2')
    refuses('not_top_of_stack', () => canUndo(events, 'E1'))
    refuses('not_found', () => canUndo(events, 'E9'))
    refuses('not_found', () => canUndo([], 'E1'))
  })

  test('spec criterion 21 (undo half): profession:advance from rank 2 then undo restores rank 2 and the three counters', () => {
    const start = makeCharacter({ professions: [{ id: 'p', name: 'Smith', rank: 2, challenges: 4, missions: 1, practiceWeeks: 9, rerollOnes: false }] })
    const advanced = applyAction(start, stamp({ kind: 'profession:advance', professionId: 'p' }, 'P1'), catalogue)
    assert.deepEqual(advanced.character.professions[0], { id: 'p', name: 'Smith', rank: 3, challenges: 0, missions: 0, practiceWeeks: 0, rerollOnes: false })
    const undone = applyInverse(advanced.character, advanced.inverse).character
    assert.deepEqual(undone.professions[0], { id: 'p', name: 'Smith', rank: 2, challenges: 4, missions: 1, practiceWeeks: 9, rerollOnes: false })
  })
})

describe('upgradeCharacter', () => {
  test('schemaVersion 1 is the identity for a character and a draft', () => {
    const c = makeCharacter()
    assert.equal(upgradeCharacter(c), c)
    const draft = { schemaVersion: 1 as const, draft: true as const, builder: {} as never, pending: [] }
    assert.equal(upgradeCharacter(draft), draft)
  })
  test('an unknown or missing schemaVersion is refused', () => {
    refuses('bad_action', () => upgradeCharacter({ schemaVersion: 2 }))
    refuses('bad_action', () => upgradeCharacter({ schemaVersion: 0 }))
    refuses('bad_action', () => upgradeCharacter({} as never))
  })
})
