import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { price, raceDelta, dieCap, aspectRankCap, requireAttunement, count, destinyLevels, xpSpent, xpRemaining, xpByKind } from '../src/pricing'
import { makeCharacter } from './fixtures'
import type { Character, Die, Purchase, Talent } from '../src/types'

const talent = (category: Talent['category'] = 'combat', destiny = false): Talent => ({ id: 't', catalogueId: 'talent', titleSnapshot: 'Talent', category, frequency: 'major', destiny, customText: null, usedThisPeriod: false, usesThisFight: 0 })
const withTalents = (categories: Talent['category'][]): Character => makeCharacter({ talents: categories.map((category, i) => ({ ...talent(category), id: `t${i}` })) })
const withHp = (n: number) => makeCharacter({ xp: { awarded: 100, purchases: Array.from({ length: n }, (_, i): Purchase => ({ id: `p${i}`, kind: 'hp', target: null, cost: i + 5, at: '2026-01-01' })) } })
const cost = (c: Character, kind: Parameters<typeof price>[1], target?: Parameters<typeof price>[2]) => price(c, kind, target)
const error = (code: string, fn: () => unknown) => assert.throws(fn, (e: any) => e.code === code)

describe('criterion 8: prices', () => {
  test('ability dice cost new die size and stop at d12', () => {
    for (const [current, expected] of [[4, 6], [6, 8], [8, 10], [10, 12]] as [Die, number][]) assert.equal(cost(makeCharacter({ abilities: { ...makeCharacter().abilities, might: { start: 4, current } } }), 'die', { ability: 'might' }), expected)
    error('die_cap', () => cost(makeCharacter({ abilities: { ...makeCharacter().abilities, might: { start: 4, current: 12 } } }), 'die', { ability: 'might' }))
    assert.equal(6 + 8 + 10 + 12, 36)
  })
  test('HP prices increase by one per +10, Dwarf discounts, Whiteling adds two', () => {
    assert.equal(cost(withHp(0), 'hp'), 5)
    assert.equal(cost(withHp(1), 'hp'), 6)
    assert.equal(cost(withHp(5), 'hp'), 10)
    assert.equal(Array.from({ length: 6 }, (_, n) => cost(withHp(n), 'hp')).reduce((a, b) => a + b), 45)
    assert.equal(cost(makeCharacter({ raceEffects: [{ kind: 'cost', purchase: 'hp', delta: -1 }] }), 'hp'), 4)
    const whiteling = makeCharacter({ hp: { baseMax: 25, current: 25, heartDieCurrent: 8 }, raceEffects: [{ kind: 'cost', purchase: 'hp', delta: 1 }, { kind: 'cost', purchase: 'hp', delta: 1 }] })
    assert.equal(cost(whiteling, 'hp'), 5.5) // The rulebook gives current max HP / 10 + 1 with no rounding rule.
    assert.equal(cost(makeCharacter({ raceEffects: whiteling.raceEffects }), 'hp'), 7)
  })
  test('aspects cost one new, ranks cost current + 1, cap and race modifiers apply', () => {
    const aspect = { id: 'a', text: 'Honor', rank: 1, source: 'created' as const, honor: true }
    const base = makeCharacter({ aspects: [aspect] })
    assert.equal(cost(base, 'aspect:new'), 1)
    for (const rank of [1, 2, 3, 4]) assert.equal(cost({ ...base, aspects: [{ ...aspect, rank }] }, 'aspect:rank', { aspectId: 'a' }), rank + 1)
    error('aspect_cap', () => cost({ ...base, aspects: [{ ...aspect, rank: 5 }] }, 'aspect:rank', { aspectId: 'a' }))
    const elf = { ...base, raceEffects: [{ kind: 'cost', purchase: 'aspect:rank', delta: -2 }, { kind: 'cost', purchase: 'aspect:new', delta: -2 }, { kind: 'aspectRankCap', max: 8 }] } as Character
    assert.equal(cost(elf, 'aspect:rank', { aspectId: 'a' }), 1)
    assert.equal(cost(elf, 'aspect:new'), 1)
    assert.equal(aspectRankCap(elf), 8)
    assert.equal(cost({ ...elf, aspects: [{ ...aspect, rank: 5 }] }, 'aspect:rank', { aspectId: 'a' }), 4)
    const shontobi = { ...base, raceEffects: [{ kind: 'cost', purchase: 'aspect:rank', delta: -1, where: { honor: true } }] } as Character
    assert.equal(cost({ ...shontobi, aspects: [{ ...aspect, rank: 2 }] }, 'aspect:rank', { aspectId: 'a' }), 2)
    assert.equal(cost({ ...shontobi, aspects: [{ ...aspect, honor: false, rank: 2 }] }, 'aspect:rank', { aspectId: 'a' }), 3)
    error('not_found', () => cost(base, 'aspect:rank', { aspectId: 'missing' }))
  })
  test('Gnome Handmagic discount matches tradition, Whiteling caps might', () => {
    const gnome = makeCharacter({ raceEffects: [{ kind: 'cost', purchase: 'talent:*', delta: -2, where: { tradition: 'Handmagic' } }, { kind: 'cost', purchase: 'destiny', delta: -2, where: { tradition: 'Handmagic' } }, { kind: 'cost', purchase: 'hp', delta: 1 }, { kind: 'dieCap', ability: 'might', max: 6 }] })
    assert.equal(cost(gnome, 'talent:combat', { talent: { tradition: 'Handmagic' } }), 1)
    assert.equal(cost(gnome, 'destiny', { talent: { tradition: 'Handmagic' } }), 3)
    assert.equal(cost(gnome, 'destiny', { talent: { tradition: 'Martial' } }), 5)
    assert.equal(cost(gnome, 'hp'), 6)
    assert.equal(dieCap(gnome, 'might'), 6)
    error('die_cap', () => cost(gnome, 'die', { ability: 'might' }))
    assert.equal(raceDelta(gnome, 'talent:noncombat', { talent: { tradition: 'Handmagic' } }), -2)
  })
  test('combat and noncombat counters are independent; elemental follows combat, or elemental with Warcaster', () => {
    for (let n = 0; n < 3; n++) assert.equal(cost(withTalents(Array(n).fill('combat')), 'talent:combat'), n + 3)
    const c = { ...withTalents(['combat', 'combat', 'racial', 'elemental']), attunements: [{ id: 'a0', element: 'fire', level: 'basic' as const, source: 'race' as const }] }
    assert.equal(count(c, 'combat'), 2)
    assert.equal(count(c, 'elemental'), 1)
    assert.equal(cost(c, 'talent:noncombat'), 3)
    assert.equal(cost(c, 'talent:elemental', { talent: { elements: ['fire'] } }), 7)
    const fire = { talent: { elements: ['fire'] } }
    const mark = (kind: 'specialization' | 'signature', title = 'Warcaster') => ({ bloodmarks: { level: 2, abilities: [{ id: 'b0', kind, title, text: '', grantedAtLevel: 1 }] } })
    const noElemental = { ...c, talents: c.talents.filter(t => t.category !== 'elemental') }
    assert.equal(cost({ ...noElemental, ...mark('specialization') }, 'talent:elemental', fire), 3)
    assert.equal(cost({ ...c, ...mark('specialization', '  WARCASTER ') }, 'talent:elemental', fire), 4)
    assert.equal(cost({ ...noElemental, ...mark('signature') }, 'talent:elemental', fire), 7)
  })
  test('attunement requires one matching element at required level; multi-element accepts either', () => {
    const c = makeCharacter({ attunements: [{ id: 'a0', element: 'Water', level: 'basic', source: 'race' }] })
    error('not_attuned', () => cost(c, 'talent:elemental', { talent: { elements: ['Fire'] } }))
    assert.equal(cost(c, 'talent:elemental', { talent: { elements: ['Fire', 'Water'] } }), 3)
    error('not_attuned', () => requireAttunement(c, { elements: ['Water'], attunementLevel: 'advanced' }))
    requireAttunement({ ...c, attunements: [{ id: 'a0', element: 'water', level: 'paragon', source: 'race' }] }, { elements: ['Water'], attunementLevel: 'advanced' })
  })
  test('destiny has one counter; path price and tier gates', () => {
    const c = withTalents(['combat', 'noncombat'])
    assert.equal(cost(c, 'destiny'), 5)
    assert.equal(cost({ ...c, talents: [{ ...c.talents[0], destiny: true }, c.talents[1]] }, 'destiny'), 6)
    assert.equal(destinyLevels(c), 0)
    assert.equal(cost({ ...c, xp: { awarded: 60, purchases: [] } }, 'path'), 12)
    assert.equal(cost({ ...c, xp: { awarded: 200, purchases: [] } }, 'path'), 40)
    error('path_locked', () => cost({ ...c, xp: { awarded: 40, purchases: [] } }, 'path'))
    for (const [tier, amount] of [[1, 12], [2, 16], [3, 20]] as const) assert.equal(cost({ ...c, path: { pathId: 'vampire', tier } }, 'path:tier'), amount)
    error('no_path', () => cost(c, 'path:tier'))
    error('tier_cap', () => cost({ ...c, path: { pathId: 'vampire', tier: 4 } }, 'path:tier'))
  })
  test('ledger spends purchase costs, not repriced current amounts', () => {
    const c = makeCharacter({ xp: { awarded: 30, purchases: [{ id: '1', kind: 'talent:combat', target: null, cost: 3, at: '' }, { id: '2', kind: 'talent:noncombat', target: null, cost: 3, at: '' }, { id: '3', kind: 'die', target: 'agility', cost: 6, at: '' }] } })
    assert.equal(xpSpent(c), 12)
    assert.equal(xpRemaining(c), 18)
    assert.deepEqual(xpByKind(c), { 'talent:combat': 3, 'talent:noncombat': 3, die: 6 })
  })
})
