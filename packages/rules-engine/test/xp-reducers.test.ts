import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import * as xpReducers from '../src/reducers/xp'
import { ELEMENTAL_AFFINITY_ID, indexById, type PlayTalent } from '../src/catalogue'
import { xpByKind, xpRemaining, xpSpent } from '../src/pricing'
import { bloodmarkPicksOwed } from '../src/bloodmarks'
import { maxHeartDie, maxHp } from '../src/derived'
import { RuleError, type ActionBody, type BoughtTalent, type Character, type Talent } from '../src/types'
import { applyAction, applyInverse } from '../src/actions'
import { makeCharacter } from './fixtures'

/** The reducer prices from this catalogue, never from the action (INV-DET). */
const entry = (id: string, category: PlayTalent['category'], over: Partial<PlayTalent> = {}): PlayTalent =>
  ({ id, path: `/t/${id}`, title: id, category, frequency: 'major', tradition: null, elements: [], body: '', destiny: null, ...over })
const TALENTS = indexById([
  entry('Cleave', 'combat'), entry('B1', 'combat'), entry('B2', 'combat'), entry('B3', 'combat'), entry('X', 'combat'),
  entry('Tinker', 'combat', { tradition: 'Handmagic' }),
  entry('Haggle', 'noncombat'),
  entry(ELEMENTAL_AFFINITY_ID, 'noncombat', { title: 'Elemental Affinity', frequency: 'passive' }),
  entry('Fireball', 'elemental', { tradition: 'Cognitive', elements: ['fire'] }),
  entry('Blizzard', 'elemental', { elements: ['Air', 'Water'] }),
])
const r = { ...xpReducers, xpBuy: (c: Character, a: Parameters<typeof xpReducers.xpBuy>[1]) => xpReducers.xpBuy(c, a, TALENTS) }

const AT = '2026-01-01T00:00:00.000Z'
type BodyOf<K extends ActionBody['kind']> = Extract<ActionBody, { kind: K }>
const act = <K extends ActionBody['kind']>(body: BodyOf<K>, id = 'A1'): BodyOf<K> & { id: string; at: string } => ({ id, at: AT, ...body })
const refuses = (code: string, fn: () => unknown) =>
  assert.throws(fn, (e: unknown) => e instanceof RuleError && e.code === code, `expected RuleError(${code})`)

const talent = (category: Talent['category'] = 'combat', over: Partial<Talent> = {}): Talent => ({
  id: 't1', catalogueId: 'x', titleSnapshot: 'Talent', category, frequency: 'major', destiny: false,
  customText: null, usedThisPeriod: false, usesThisFight: 0, ...over,
})
const bought = (catalogueId: string, over: Partial<BoughtTalent> = {}): BoughtTalent => ({ catalogueId, ...over })
/** An action as a hostile client could send it: any extra fields. */
const forged = (body: Record<string, unknown>, id = 'A1') => ({ id, at: AT, ...body }) as Parameters<typeof r.xpBuy>[1]
const withXp = (awarded: number, c: Character = makeCharacter()): Character => ({ ...c, xp: { ...c.xp, awarded } })
const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o) }
  return o
}

describe('criterion 9: xp:buy', () => {
  test('starting example: awarded 30, combat 3 + noncombat 3 + agility d4→d6 6 → spent 12, remaining 18, by kind', () => {
    let c = withXp(30)
    c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'talent:combat', talent: bought('Cleave') }, 'B1'))
    c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'talent:noncombat', talent: bought('Haggle') }, 'B2'))
    c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'die', target: { ability: 'agility' } }, 'B3'))
    assert.equal(xpSpent(c), 12)
    assert.equal(xpRemaining(c), 18)
    assert.deepEqual(xpByKind(c), { 'talent:combat': 3, 'talent:noncombat': 3, die: 6 })
    assert.equal(c.abilities.agility.current, 6)
    assert.equal(c.abilities.agility.start, 4)
  })
  test('price above remaining XP is refused with insufficient_xp and the character is unchanged', () => {
    const c = deepFreeze(withXp(5))
    refuses('insufficient_xp', () => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'die', target: { ability: 'agility' } })))
    assert.deepEqual(c, withXp(5))
  })
  test('a price equal to the remaining XP is allowed and leaves 0', () => {
    const c = r.xpBuy(withXp(6), act({ kind: 'xp:buy', purchase: 'die', target: { ability: 'agility' } }))
    assert.equal(xpRemaining(c), 0)
  })
  test('the price is taken from the character before the purchase: combat talents cost 3, 4, 5', () => {
    let c = withXp(100)
    const costs: number[] = []
    for (const id of ['B1', 'B2', 'B3']) {
      c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'talent:combat', talent: bought(id) }, id))
      costs.push(c.xp.purchases.at(-1)!.cost)
    }
    assert.deepEqual(costs, [3, 4, 5])
  })
  test('ids: the purchase is <id>:0 and the appended talent is <id>:1; the purchase targets the talent', () => {
    const c = r.xpBuy(withXp(30), act({ kind: 'xp:buy', purchase: 'talent:combat', talent: bought('Cleave') }, 'B1'))
    assert.deepEqual(c.xp.purchases, [{ id: 'B1:0', kind: 'talent:combat', target: 'B1:1', cost: 3, at: AT }])
    assert.deepEqual(c.talents, [{ id: 'B1:1', catalogueId: 'Cleave', titleSnapshot: 'Cleave', category: 'combat', frequency: 'major', destiny: false, customText: null, usedThisPeriod: false, usesThisFight: 0 }])
  })
  test('ability dice step d4→d6→d8→d10→d12 for 6, 8, 10, 12 and stop at d12', () => {
    let c = withXp(100, makeCharacter({ abilities: { ...makeCharacter().abilities, might: { start: 4, current: 4 } } }))
    const costs: number[] = []
    for (let i = 0; i < 4; i++) {
      c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'die', target: { ability: 'might' } }, `D${i}`))
      costs.push(c.xp.purchases.at(-1)!.cost)
    }
    assert.deepEqual(costs, [6, 8, 10, 12])
    assert.equal(c.abilities.might.current, 12)
    assert.deepEqual(c.xp.purchases.map(p => p.target), ['might', 'might', 'might', 'might'])
    refuses('die_cap', () => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'die', target: { ability: 'might' } }, 'D9')))
  })
  test('a race die cap stops the purchase', () => {
    const c = withXp(100, makeCharacter({ raceEffects: [{ kind: 'dieCap', ability: 'might', max: 6 }] }))
    refuses('die_cap', () => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'die', target: { ability: 'might' } })))
  })
  test('hp: +10 max HP for 5, then 6; the purchase has no target; current HP is not changed', () => {
    let c = withXp(100)
    c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'hp' }, 'H1'))
    c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'hp' }, 'H2'))
    assert.deepEqual(c.xp.purchases.map(p => [p.cost, p.target]), [[5, null], [6, null]])
    assert.equal(maxHp(c), 60)
    assert.equal(c.hp.current, 40)
  })
  test('hp: the price E2 returns is stored unrounded (25 max HP → 3.5)', () => {
    const odd = withXp(100, makeCharacter({ hp: { baseMax: 25, current: 25, heartDieCurrent: 8 } }))
    const c = r.xpBuy(odd, act({ kind: 'xp:buy', purchase: 'hp' }))
    assert.equal(c.xp.purchases[0]!.cost, 3.5)
    assert.equal(xpRemaining(c), 96.5)
  })
  test('aspect:new needs text, costs 1 and appends a purchased rank-1 aspect <id>:1; blank text is refused', () => {
    const c = r.xpBuy(withXp(5), act({ kind: 'xp:buy', purchase: 'aspect:new', aspectText: 'Haunted by the sea' }, 'N1'))
    assert.deepEqual(c.aspects, [{ id: 'N1:1', text: 'Haunted by the sea', rank: 1, source: 'purchased', honor: false }])
    assert.deepEqual(c.xp.purchases, [{ id: 'N1:0', kind: 'aspect:new', target: 'N1:1', cost: 1, at: AT }])
    refuses('bad_action', () => r.xpBuy(withXp(5), act({ kind: 'xp:buy', purchase: 'aspect:new', aspectText: '  ' })))
    refuses('bad_action', () => r.xpBuy(withXp(5), act({ kind: 'xp:buy', purchase: 'aspect:new' })))
  })
  test('aspect:rank costs current + 1, raises that aspect only, and stops at the cap', () => {
    const aspects = [{ id: 'a1', text: 'One', rank: 1, source: 'created' as const, honor: false }, { id: 'a2', text: 'Two', rank: 4, source: 'created' as const, honor: false }]
    let c = withXp(50, makeCharacter({ aspects }))
    c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'aspect:rank', target: { aspectId: 'a1' } }, 'R1'))
    c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'aspect:rank', target: { aspectId: 'a2' } }, 'R2'))
    assert.deepEqual(c.aspects.map(a => a.rank), [2, 5])
    assert.deepEqual(c.xp.purchases.map(p => [p.cost, p.target]), [[2, 'a1'], [5, 'a2']])
    refuses('aspect_cap', () => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'aspect:rank', target: { aspectId: 'a2' } }, 'R3')))
    refuses('not_found', () => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'aspect:rank', target: { aspectId: 'nope' } }, 'R3')))
  })
  test('talent purchases need the talent fields; they are refused on other kinds', () => {
    refuses('bad_action', () => r.xpBuy(withXp(30), act({ kind: 'xp:buy', purchase: 'talent:combat' })))
    refuses('not_found', () => r.xpBuy(withXp(30), act({ kind: 'xp:buy', purchase: 'talent:combat', talent: bought('nope') })))
    refuses('bad_action', () => r.xpBuy(withXp(30), act({ kind: 'xp:buy', purchase: 'hp', talent: bought('Cleave') })))
  })
  test('elemental talent: refused without attunement, priced (combat × 2) + 3', () => {
    const base = withXp(100, makeCharacter({ talents: [talent('combat', { id: 'c1' }), talent('combat', { id: 'c2' })] }))
    refuses('not_attuned', () => r.xpBuy(base, act({ kind: 'xp:buy', purchase: 'talent:elemental', talent: bought('Fireball') })))
    const attuned = { ...base, attunements: [{ id: 'at1', element: 'fire', level: 'basic' as const, source: 'race' }] }
    const c = r.xpBuy(attuned, act({ kind: 'xp:buy', purchase: 'talent:elemental', talent: bought('Fireball') }))
    assert.equal(c.xp.purchases[0]!.cost, 7)
    assert.equal(c.talents.at(-1)!.category, 'elemental')
  })
  test('a Handmagic discount is applied from the catalogue tradition and the stored cost is the discounted price', () => {
    const gnome = withXp(30, makeCharacter({ raceEffects: [{ kind: 'cost', purchase: 'talent:*', delta: -2, where: { tradition: 'Handmagic' } }] }))
    const c = r.xpBuy(gnome, act({ kind: 'xp:buy', purchase: 'talent:combat', talent: bought('Tinker') }))
    assert.equal(c.xp.purchases[0]!.cost, 1)
    assert.equal(r.xpBuy(gnome, act({ kind: 'xp:buy', purchase: 'talent:combat', talent: bought('Cleave') })).xp.purchases[0]!.cost, 3)
  })
  test('a client cannot change the price or the prerequisite: facts sent in the action are ignored, the catalogue entry decides', () => {
    const gnome = withXp(30, makeCharacter({ raceEffects: [{ kind: 'cost', purchase: 'talent:*', delta: -2, where: { tradition: 'Handmagic' } }] }))
    // Cleave is not Handmagic; the claimed tradition is dropped, so the Gnome pays full price.
    const forgedBuy = forged({ kind: 'xp:buy', purchase: 'talent:combat', talent: bought('Cleave'), target: { talent: { tradition: 'Handmagic' } } })
    assert.equal(r.xpBuy(gnome, forgedBuy).xp.purchases[0]!.cost, 3)
    // A spell's elements come from the entry: claiming an element the character holds does not satisfy a fire spell.
    const water = withXp(30, makeCharacter({ attunements: [{ id: 'at0', element: 'water', level: 'basic', source: 'race' }] }))
    const claimed = forged({ kind: 'xp:buy', purchase: 'talent:elemental', talent: bought('Fireball'), target: { talent: { elements: ['water'] } } })
    refuses('not_attuned', () => r.xpBuy(water, claimed))
    // The stored talent is the catalogue entry's, not the client's title or frequency.
    const t = r.xpBuy(withXp(30), forged({ kind: 'xp:buy', purchase: 'talent:combat', talent: { ...bought('Cleave'), titleSnapshot: 'Free', frequency: 'passive' } })).talents[0]!
    assert.deepEqual([t.titleSnapshot, t.frequency], ['Cleave', 'major'])
    // A destiny level on a Handmagic talent is discounted by the owned talent's tradition, not a claimed one.
    const mixed = withXp(30, makeCharacter({ talents: [talent('combat', { id: 't1', catalogueId: 'Cleave' })], raceEffects: [{ kind: 'cost', purchase: 'destiny', delta: -2, where: { tradition: 'Handmagic' } }] }))
    assert.equal(r.xpBuy(mixed, forged({ kind: 'xp:buy', purchase: 'destiny', target: { talentId: 't1', talent: { tradition: 'Handmagic' } } })).xp.purchases[0]!.cost, 5)
  })
  test('a talent bought as another kind, or an unknown catalogue id, is refused', () => {
    refuses('bad_action', () => r.xpBuy(withXp(30), act({ kind: 'xp:buy', purchase: 'talent:noncombat', talent: bought('Cleave') })))
    refuses('not_found', () => r.xpBuy(withXp(30), act({ kind: 'xp:buy', purchase: 'talent:combat', talent: bought('made-up') })))
  })
  test('destiny: marks one owned talent, first costs 5, second 6; a second level on one talent, an unknown talent or none is refused', () => {
    const c0 = withXp(50, makeCharacter({ talents: [talent('combat', { id: 't1' }), talent('noncombat', { id: 't2' })] }))
    let c = r.xpBuy(c0, act({ kind: 'xp:buy', purchase: 'destiny', target: { talentId: 't1' } }, 'Y1'))
    assert.deepEqual(c.talents.map(t => t.destiny), [true, false])
    assert.deepEqual(c.xp.purchases[0], { id: 'Y1:0', kind: 'destiny', target: 't1', cost: 5, at: AT })
    c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'destiny', target: { talentId: 't2' } }, 'Y2'))
    assert.equal(c.xp.purchases[1]!.cost, 6)
    refuses('bad_action', () => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'destiny', target: { talentId: 't1' } }, 'Y3')))
    refuses('not_found', () => r.xpBuy(c0, act({ kind: 'xp:buy', purchase: 'destiny', target: { talentId: 'nope' } })))
    refuses('bad_action', () => r.xpBuy(c0, act({ kind: 'xp:buy', purchase: 'destiny' })))
  })
  test('a Gnome Handmagic destiny discount follows the owned talent\'s catalogue tradition: 3 for Handmagic, 5 otherwise', () => {
    const gnome = withXp(30, makeCharacter({ talents: [talent('combat', { id: 't1', catalogueId: 'Tinker' }), talent('combat', { id: 't2', catalogueId: 'Cleave' })], raceEffects: [{ kind: 'cost', purchase: 'destiny', delta: -2, where: { tradition: 'Handmagic' } }] }))
    assert.equal(r.xpBuy(gnome, act({ kind: 'xp:buy', purchase: 'destiny', target: { talentId: 't1' } })).xp.purchases[0]!.cost, 3)
    assert.equal(r.xpBuy(gnome, act({ kind: 'xp:buy', purchase: 'destiny', target: { talentId: 't2' } })).xp.purchases[0]!.cost, 5)
  })
  test('path: needs 50 awarded XP, costs 20% (min 10), starts at tier 1 and only one is allowed; tiers cost 12, 16, 20', () => {
    refuses('path_locked', () => r.xpBuy(withXp(49), act({ kind: 'xp:buy', purchase: 'path', target: { pathId: 'vampire' } })))
    refuses('bad_action', () => r.xpBuy(withXp(200), act({ kind: 'xp:buy', purchase: 'path' })))
    refuses('no_path', () => r.xpBuy(withXp(200), act({ kind: 'xp:buy', purchase: 'path:tier' })))
    let c = r.xpBuy(withXp(200), act({ kind: 'xp:buy', purchase: 'path', target: { pathId: 'vampire' } }, 'P1'))
    assert.deepEqual(c.path, { pathId: 'vampire', tier: 1 })
    assert.deepEqual(c.xp.purchases[0], { id: 'P1:0', kind: 'path', target: 'vampire', cost: 40, at: AT })
    refuses('path_locked', () => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'path', target: { pathId: 'vampire' } }, 'P9')))
    const costs: number[] = []
    for (const id of ['T2', 'T3', 'T4']) {
      c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'path:tier' }, id))
      costs.push(c.xp.purchases.at(-1)!.cost)
    }
    assert.deepEqual(costs, [12, 16, 20])
    assert.equal(c.path!.tier, 4)
    assert.equal(c.xp.purchases.at(-1)!.target, null)
    refuses('tier_cap', () => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'path:tier' }, 'T5')))
  })
})

describe('criterion 8b: Elemental Affinity', () => {
  const human = () => withXp(100, makeCharacter({ attunements: [{ id: 'at0', element: 'fire', level: 'basic', source: 'race' }] }))
  const affinity = (element: string, id: string) => act({ kind: 'xp:buy', purchase: 'talent:noncombat', talent: bought(ELEMENTAL_AFFINITY_ID, { attunementElement: element }) }, id)

  test('a new element adds {water, basic}, in creation order: purchase :0, talent :1, attunement :2', () => {
    const c = r.xpBuy(human(), affinity('water', 'E1'))
    assert.deepEqual(c.attunements, [
      { id: 'at0', element: 'fire', level: 'basic', source: 'race' },
      { id: 'E1:2', element: 'water', level: 'basic', source: 'talent' },
    ])
    assert.equal(c.talents[0]!.category, 'noncombat')
    assert.equal(c.talents[0]!.id, 'E1:1')
    assert.equal(c.xp.purchases[0]!.id, 'E1:0')
  })
  test('buying it again for water makes the one water attunement advanced; fire basic stays', () => {
    let c = r.xpBuy(human(), affinity('water', 'E1'))
    c = r.xpBuy(c, affinity('water', 'E2'))
    assert.deepEqual(c.attunements.map(a => [a.element, a.level]), [['fire', 'basic'], ['water', 'advanced']])
    assert.equal(c.talents.length, 2)
    assert.deepEqual(c.xp.purchases.map(p => p.cost), [3, 4])
  })
  test('the racial fire attunement can also be raised to advanced', () => {
    const c = r.xpBuy(human(), affinity('fire', 'E1'))
    assert.deepEqual(c.attunements.map(a => [a.id, a.element, a.level]), [['at0', 'fire', 'advanced']])
  })
  test('element names match case-insensitively', () => {
    const c = r.xpBuy(human(), affinity('Fire', 'E1'))
    assert.deepEqual(c.attunements.map(a => [a.element, a.level]), [['fire', 'advanced']])
  })
  test('an advanced attunement cannot be raised by Elemental Affinity, an unknown element is refused, and nothing is charged', () => {
    const advanced = { ...human(), attunements: [{ id: 'at0', element: 'fire', level: 'advanced' as const, source: 'race' }] }
    refuses('bad_action', () => r.xpBuy(advanced, affinity('fire', 'E1')))
    refuses('bad_action', () => r.xpBuy(human(), affinity('ice', 'E1')))
    refuses('bad_action', () => r.xpBuy(withXp(10), act({ kind: 'xp:buy', purchase: 'talent:combat', talent: bought('X', { attunementElement: 'fire' }) })))
  })
  test('the new attunement lets an elemental talent be bought afterwards', () => {
    const base = withXp(100)
    let c = r.xpBuy(base, affinity('water', 'E1'))
    c = r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'talent:elemental', talent: bought('Blizzard') }, 'E2'))
    assert.equal(c.talents.at(-1)!.category, 'elemental')
  })
})

describe('criterion 8b: xp:award', () => {
  const craven = (awarded = 0) => withXp(awarded, makeCharacter({ raceEffects: [{ kind: 'awardBonus', per: 7, bonus: 1 }] }))
  test('Craven award 14 → +16; award 6 → +6; award 7 → +8; the bonus is part of xp.awarded', () => {
    assert.equal(r.xpAward(craven(), act({ kind: 'xp:award', amount: 14 })).xp.awarded, 16)
    assert.equal(r.xpAward(craven(), act({ kind: 'xp:award', amount: 6 })).xp.awarded, 6)
    assert.equal(r.xpAward(craven(), act({ kind: 'xp:award', amount: 7 })).xp.awarded, 8)
    assert.equal(r.xpAward(craven(10), act({ kind: 'xp:award', amount: 14 })).xp.awarded, 26)
  })
  test('without a bonus effect the amount is added as given', () => {
    assert.equal(r.xpAward(withXp(30), act({ kind: 'xp:award', amount: 4 })).xp.awarded, 34)
  })
  test('bonus effects add: two per-7 effects each apply', () => {
    const c = withXp(0, makeCharacter({ raceEffects: [{ kind: 'awardBonus', per: 7, bonus: 1 }, { kind: 'awardBonus', per: 5, bonus: 2 }] }))
    assert.equal(r.xpAward(c, act({ kind: 'xp:award', amount: 14 })).xp.awarded, 14 + 2 + 4)
  })
  test('awarded XP raises the maximum heart die at 200', () => {
    const c = r.xpAward(withXp(195), act({ kind: 'xp:award', amount: 5 }))
    assert.equal(maxHeartDie(c), 10)
  })
  test('amounts must be whole numbers of at least 1', () => {
    for (const amount of [0, -3, 1.5, Number.NaN, Infinity]) refuses('invalid_amount', () => r.xpAward(makeCharacter(), act({ kind: 'xp:award', amount })))
  })
})

describe('criterion 8b: bloodmarks', () => {
  const owed = (c: Character) => bloodmarkPicksOwed(c)
  const pick = (kind: 'specialization' | 'signature' | 'mastery' | 'paragon', title = 'Ability') => ({ kind, title, text: 'Rules text' })
  const award = (c: Character, id: string) => r.bloodmarkAward(c, act({ kind: 'bloodmark:award' }, id))

  test('level 0 owes nothing; awarding to level 2 owes 2 specializations and 1 signature', () => {
    assert.deepEqual(owed(makeCharacter()), { specialization: 0, signature: 0, mastery: 0, paragon: 0 })
    const c = award(award(makeCharacter(), 'L1'), 'L2')
    assert.equal(c.bloodmarks.level, 2)
    assert.deepEqual(owed(c), { specialization: 2, signature: 1, mastery: 0, paragon: 0 })
  })
  test('bloodmark:award adds a level and no XP', () => {
    const c = award(withXp(7), 'L1')
    assert.equal(c.xp.awarded, 7)
    assert.equal(c.bloodmarks.level, 1)
  })
  test('picking a mastery at level 2 is refused; the character is unchanged', () => {
    const c = deepFreeze(award(award(makeCharacter(), 'L1'), 'L2'))
    refuses('bloodmark_not_owed', () => r.bloodmarkPick(c, act({ kind: 'bloodmark:pick', ability: pick('mastery') })))
  })
  test('a pick is stored with id <id>:0 and the level it was granted at, and lowers what is owed', () => {
    let c = award(award(makeCharacter(), 'L1'), 'L2')
    c = r.bloodmarkPick(c, act({ kind: 'bloodmark:pick', ability: pick('signature', 'Rally') }, 'K1'))
    assert.deepEqual(c.bloodmarks.abilities, [{ id: 'K1:0', kind: 'signature', title: 'Rally', text: 'Rules text', grantedAtLevel: 2 }])
    assert.deepEqual(owed(c), { specialization: 2, signature: 0, mastery: 0, paragon: 0 })
    refuses('bloodmark_not_owed', () => r.bloodmarkPick(c, act({ kind: 'bloodmark:pick', ability: pick('signature') }, 'K2')))
  })
  test('a pick on a character with level 0 is refused; blank titles are refused', () => {
    refuses('bloodmark_not_owed', () => r.bloodmarkPick(makeCharacter(), act({ kind: 'bloodmark:pick', ability: pick('specialization') })))
    refuses('bad_action', () => r.bloodmarkPick(award(makeCharacter(), 'L1'), act({ kind: 'bloodmark:pick', ability: pick('specialization', '  ') })))
  })
  test('levels 4 and 5 owe a mastery and a paragon; picks of each are accepted once', () => {
    let c = makeCharacter()
    for (let i = 1; i <= 5; i++) c = award(c, `L${i}`)
    assert.deepEqual(owed(c), { specialization: 2, signature: 3, mastery: 1, paragon: 1 })
    c = r.bloodmarkPick(c, act({ kind: 'bloodmark:pick', ability: pick('mastery') }, 'K1'))
    c = r.bloodmarkPick(c, act({ kind: 'bloodmark:pick', ability: pick('paragon') }, 'K2'))
    assert.deepEqual(c.bloodmarks.abilities.map(a => [a.kind, a.grantedAtLevel]), [['mastery', 5], ['paragon', 5]])
    refuses('bloodmark_not_owed', () => r.bloodmarkPick(c, act({ kind: 'bloodmark:pick', ability: pick('paragon') }, 'K3')))
  })
})

describe('Warcaster bloodmark pick', () => {
  const pick = (element?: string, title = 'Warcaster') => ({ kind: 'specialization' as const, title, text: 'Rules text', ...(element === undefined ? {} : { element }) })
  const level1 = () => r.bloodmarkAward(makeCharacter(), act({ kind: 'bloodmark:award' }, 'L1'))

  test('with an element it adds a basic attunement whose source is the new ability id, and undo removes it', () => {
    const before = level1()
    const { character, inverse } = applyAction(before, act({ kind: 'bloodmark:pick', ability: pick(' Fire ') }, 'K1'), { conditions: new Map(), talents: TALENTS })
    assert.deepEqual(character.attunements.at(-1), { id: 'K1:1', element: 'fire', level: 'basic', source: 'K1:0' })
    assert.equal(character.bloodmarks.abilities[0]!.id, 'K1:0')
    assert.deepEqual(applyInverse(character, inverse).character, before)
  })
  test('without an element, with an unknown element, or with an element already attuned it is refused', () => {
    const c = level1()
    refuses('bad_action', () => r.bloodmarkPick(c, act({ kind: 'bloodmark:pick', ability: pick() })))
    refuses('bad_action', () => r.bloodmarkPick(c, act({ kind: 'bloodmark:pick', ability: pick('plasma') })))
    const attuned = { ...c, attunements: [{ id: 'at1', element: 'fire', level: 'advanced' as const, source: 'race' }] }
    refuses('bad_action', () => r.bloodmarkPick(attuned, act({ kind: 'bloodmark:pick', ability: pick('Fire') })))
  })
  test('a pick that is not Warcaster ignores the element', () => {
    const c = r.bloodmarkPick(level1(), act({ kind: 'bloodmark:pick', ability: pick('plasma', 'Other') }))
    assert.deepEqual(c.attunements, [])
  })
})

describe('purity', () => {
  test('frozen inputs are not mutated and the same call twice gives equal results', () => {
    const c = deepFreeze(withXp(100, makeCharacter({ talents: [talent('combat', { id: 't1' })], attunements: [{ id: 'at0', element: 'fire', level: 'basic', source: 'race' }] })))
    const calls: Array<(c: Character) => Character> = [
      c => r.xpAward(c, act({ kind: 'xp:award', amount: 9 })),
      c => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'hp' })),
      c => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'destiny', target: { talentId: 't1' } })),
      c => r.xpBuy(c, act({ kind: 'xp:buy', purchase: 'talent:noncombat', talent: bought(ELEMENTAL_AFFINITY_ID, { attunementElement: 'fire' }) })),
      c => r.bloodmarkAward(c, act({ kind: 'bloodmark:award' })),
    ]
    for (const call of calls) assert.deepEqual(call(c), call(c))
  })
})
