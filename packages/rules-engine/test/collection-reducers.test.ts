import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { reduceCollections, isCollectionAction, type CollectionAction } from '../src/reducers/collections'
import { defenseBonus, weaponDice, slotsUsed } from '../src/derived'
import { RuleError, type Action, type Character } from '../src/types'
import { makeCharacter, weapon } from './fixtures'

const at = '2026-01-01T00:00:00.000Z'
type Body<A> = A extends unknown ? Omit<A, 'id' | 'at'> : never
const act = (id: string, body: Body<CollectionAction>): CollectionAction => ({ id, at, ...body }) as CollectionAction
const notFound = (e: unknown) => e instanceof RuleError && e.code === 'not_found'
const invalidAmount = (e: unknown) => e instanceof RuleError && e.code === 'invalid_amount'

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const v of Object.values(o)) deepFreeze(v)
  }
  return o
}
const wieldedIds = (c: Character) => c.gear.weapons.filter(w => w.wielded).map(w => w.id)
const newWeapon = { name: 'Bow', size: 'H', damageType: 'P', attackType: 'ranged', reach: false, misc: 0, wielded: false } as const

describe('gear: weapons', () => {
  test('an add creates <action id>:0 and appends the weapon', () => {
    const c = reduceCollections(makeCharacter(), act('A1', { kind: 'gear:weapon:add', weapon: newWeapon }))
    assert.equal(c.gear.weapons.length, 1)
    assert.equal(c.gear.weapons[0]!.id, 'A1:0')
    assert.equal(c.gear.weapons[0]!.name, 'Bow')
  })

  test('wielding a second weapon unwields the first', () => {
    const base = makeCharacter({ gear: { ...makeCharacter().gear, weapons: [weapon({ id: 'w1', wielded: true }), weapon({ id: 'w2', wielded: false })] } })
    const c = reduceCollections(base, act('A2', { kind: 'gear:wield', weaponId: 'w2' }))
    assert.deepEqual(wieldedIds(c), ['w2'])
    assert.equal(c.gear.weapons.find(w => w.id === 'w1')!.wielded, false)
  })

  test('wield null unwields every weapon, so the dice show as none', () => {
    const base = makeCharacter({ gear: { ...makeCharacter().gear, weapons: [weapon({ id: 'w1', wielded: true })] } })
    const c = reduceCollections(base, act('A3', { kind: 'gear:wield', weaponId: null }))
    assert.deepEqual(wieldedIds(c), [])
    assert.equal(weaponDice(c, 'might'), null)
  })

  test('wielding an unknown weapon → not_found', () => {
    assert.throws(() => reduceCollections(makeCharacter(), act('A4', { kind: 'gear:wield', weaponId: 'nope' })), notFound)
  })

  test('adding a wielded weapon unwields the previous one', () => {
    const base = makeCharacter({ gear: { ...makeCharacter().gear, weapons: [weapon({ id: 'w1', wielded: true })] } })
    const c = reduceCollections(base, act('A5', { kind: 'gear:weapon:add', weapon: { ...newWeapon, wielded: true } }))
    assert.deepEqual(wieldedIds(c), ['A5:0'])
  })

  test('editing a weapon to wielded unwields the others; editing it to unwielded leaves none', () => {
    const base = makeCharacter({ gear: { ...makeCharacter().gear, weapons: [weapon({ id: 'w1', wielded: true }), weapon({ id: 'w2', wielded: false })] } })
    const c = reduceCollections(base, act('A6', { kind: 'gear:weapon:edit', weapon: { id: 'w2', wielded: true, misc: 2 } }))
    assert.deepEqual(wieldedIds(c), ['w2'])
    assert.equal(c.gear.weapons[1]!.misc, 2)
    const d = reduceCollections(c, act('A7', { kind: 'gear:weapon:edit', weapon: { id: 'w2', wielded: false } }))
    assert.deepEqual(wieldedIds(d), [])
  })

  test('an edit changes only the named fields and never the id', () => {
    const base = makeCharacter({ gear: { ...makeCharacter().gear, weapons: [weapon({ id: 'w1', name: 'Axe', misc: 1 })] } })
    const c = reduceCollections(base, act('A8', { kind: 'gear:weapon:edit', weapon: { id: 'w1', name: 'Great Axe' } }))
    assert.deepEqual(c.gear.weapons[0], { ...base.gear.weapons[0]!, name: 'Great Axe' })
  })

  test('editing or removing an unknown weapon → not_found', () => {
    assert.throws(() => reduceCollections(makeCharacter(), act('A9', { kind: 'gear:weapon:edit', weapon: { id: 'nope', name: 'x' } })), notFound)
    assert.throws(() => reduceCollections(makeCharacter(), act('A9', { kind: 'gear:weapon:remove', weaponId: 'nope' })), notFound)
  })

  test('remove deletes by id', () => {
    const base = makeCharacter({ gear: { ...makeCharacter().gear, weapons: [weapon({ id: 'w1' }), weapon({ id: 'w2', wielded: false })] } })
    const c = reduceCollections(base, act('A10', { kind: 'gear:weapon:remove', weaponId: 'w1' }))
    assert.deepEqual(c.gear.weapons.map(w => w.id), ['w2'])
  })

  test('a non-integer misc → invalid_amount', () => {
    assert.throws(() => reduceCollections(makeCharacter(), act('A11', { kind: 'gear:weapon:add', weapon: { ...newWeapon, misc: 1.5 } })), invalidAmount)
  })

  test('property: after any sequence of add/edit/wield/remove at most one weapon is wielded', () => {
    const step = fc.oneof(
      fc.record({ k: fc.constant('add' as const), wielded: fc.boolean() }),
      fc.record({ k: fc.constant('edit' as const), pick: fc.nat(), wielded: fc.boolean() }),
      fc.record({ k: fc.constant('wield' as const), pick: fc.option(fc.nat(), { nil: null }) }),
      fc.record({ k: fc.constant('remove' as const), pick: fc.nat() }),
    )
    fc.assert(fc.property(fc.array(step, { maxLength: 25 }), steps => {
      let c = makeCharacter({ gear: { ...makeCharacter().gear, weapons: [weapon({ id: 'w1', wielded: true }), weapon({ id: 'w2', wielded: false }), weapon({ id: 'w3', wielded: false })] } })
      steps.forEach((s, i) => {
        const id = `a${i}`
        const pick = (n: number) => c.gear.weapons[n % c.gear.weapons.length]?.id ?? 'missing'
        const a = s.k === 'add' ? act(id, { kind: 'gear:weapon:add', weapon: { ...newWeapon, wielded: s.wielded } })
          : s.k === 'edit' ? act(id, { kind: 'gear:weapon:edit', weapon: { id: pick(s.pick), wielded: s.wielded } })
          : s.k === 'wield' ? act(id, { kind: 'gear:wield', weaponId: s.pick === null ? null : pick(s.pick) })
          : act(id, { kind: 'gear:weapon:remove', weaponId: pick(s.pick) })
        try { c = reduceCollections(c, a) } catch (e) { if (!notFound(e)) throw e }
        assert.ok(wieldedIds(c).length <= 1)
      })
    }))
  })
})

describe('gear: armor, shield, wear', () => {
  test('armor set + shield set + wear feed the defense bonus (heavy armor misc 1 + light shield misc 2 = 10)', () => {
    let c = makeCharacter()
    c = reduceCollections(c, act('B1', { kind: 'gear:armor:set', armor: { name: 'Plate', weight: 'H', misc: 1 } }))
    c = reduceCollections(c, act('B2', { kind: 'gear:shield:set', shield: { name: 'Buckler', weight: 'L', misc: 2 } }))
    assert.equal(defenseBonus(c), 0, 'set does not wear')
    c = reduceCollections(c, act('B3', { kind: 'gear:wear', piece: 'armor', worn: true }))
    c = reduceCollections(c, act('B4', { kind: 'gear:wear', piece: 'shield', worn: true }))
    assert.equal(defenseBonus(c), 10)
    c = reduceCollections(c, act('B5', { kind: 'gear:wear', piece: 'shield', worn: false }))
    assert.equal(defenseBonus(c), 7)
  })

  test('armor set merges: unnamed fields keep their value', () => {
    const c0 = reduceCollections(makeCharacter(), act('B6', { kind: 'gear:armor:set', armor: { name: 'Leather', weight: 'L', worn: true } }))
    const c1 = reduceCollections(c0, act('B7', { kind: 'gear:armor:set', armor: { misc: 1 } }))
    assert.deepEqual(c1.gear.armor, { name: 'Leather', weight: 'L', misc: 1, worn: true })
  })
})

describe('gear: items and coins', () => {
  test('an item add creates <id>:0 and counts toward slots', () => {
    const c = reduceCollections(makeCharacter(), act('C1', { kind: 'gear:item:add', item: { name: 'Rations', slots: 1, quantity: 3, notes: '' } }))
    assert.equal(c.gear.items[0]!.id, 'C1:0')
    assert.equal(slotsUsed(c), 3)
  })

  test('edit changes named fields; unknown id → not_found; remove by id', () => {
    const base = reduceCollections(makeCharacter(), act('C2', { kind: 'gear:item:add', item: { name: 'Rope', slots: 1, quantity: 1, notes: '' } }))
    const c = reduceCollections(base, act('C3', { kind: 'gear:item:edit', item: { id: 'C2:0', quantity: 2 } }))
    assert.deepEqual(c.gear.items[0], { id: 'C2:0', name: 'Rope', slots: 1, quantity: 2, notes: '' })
    assert.throws(() => reduceCollections(base, act('C4', { kind: 'gear:item:edit', item: { id: 'nope', quantity: 2 } })), notFound)
    assert.throws(() => reduceCollections(base, act('C4', { kind: 'gear:item:remove', itemId: 'nope' })), notFound)
    assert.deepEqual(reduceCollections(base, act('C5', { kind: 'gear:item:remove', itemId: 'C2:0' })).gear.items, [])
  })

  test('negative or fractional quantity and negative slots → invalid_amount; a 0.2 slot is fine', () => {
    const add = (item: { name: string; slots: number; quantity: number; notes: string }) => () => reduceCollections(makeCharacter(), act('C6', { kind: 'gear:item:add', item }))
    assert.throws(add({ name: 'x', slots: 1, quantity: -1, notes: '' }), invalidAmount)
    assert.throws(add({ name: 'x', slots: 1, quantity: 1.5, notes: '' }), invalidAmount)
    assert.throws(add({ name: 'x', slots: -1, quantity: 1, notes: '' }), invalidAmount)
    assert.equal(add({ name: 'Coin pouch', slots: 0.2, quantity: 1, notes: '' })().gear.items[0]!.slots, 0.2)
  })

  test('coins set merges the named denominations', () => {
    const c0 = reduceCollections(makeCharacter(), act('D1', { kind: 'gear:coins:set', coins: { iron: 12, crown: 1 } }))
    const c1 = reduceCollections(c0, act('D2', { kind: 'gear:coins:set', coins: { iron: 3 } }))
    assert.deepEqual(c1.gear.coins, { iron: 3, obol: 0, lire: 0, ducat: 0, crown: 1 })
  })

  test('negative or fractional coins → invalid_amount, state unchanged', () => {
    assert.throws(() => reduceCollections(makeCharacter(), act('D3', { kind: 'gear:coins:set', coins: { obol: -1 } })), invalidAmount)
    assert.throws(() => reduceCollections(makeCharacter(), act('D3', { kind: 'gear:coins:set', coins: { obol: 0.5 } })), invalidAmount)
  })
})

describe('aspects', () => {
  const base = makeCharacter({ aspects: [{ id: 'A:0', text: 'Old', rank: 3, source: 'purchased', honor: false }] })

  test('edit changes text and honor only; a rank or source smuggled in is ignored', () => {
    const sneaky = { id: 'A:0', text: 'New', honor: true, rank: 6, source: 'created' } as unknown as { id: string; text: string }
    const c = reduceCollections(base, act('E4', { kind: 'aspect:edit', aspect: sneaky }))
    assert.deepEqual(c.aspects[0], { id: 'A:0', text: 'New', rank: 3, source: 'purchased', honor: true })
  })

  test('editing or removing an unknown aspect → not_found; remove by id', () => {
    assert.throws(() => reduceCollections(base, act('E6', { kind: 'aspect:edit', aspect: { id: 'nope', text: 'x' } })), notFound)
    assert.throws(() => reduceCollections(base, act('E6', { kind: 'aspect:remove', aspectId: 'nope' })), notFound)
    assert.deepEqual(reduceCollections(base, act('E7', { kind: 'aspect:remove', aspectId: 'A:0' })).aspects, [])
  })

  test('there is no free aspect:add: a new aspect comes only through xp:buy', () => {
    assert.ok(!isCollectionAction({ id: 'x', at, kind: 'aspect:add', aspect: { text: 'x' } } as unknown as Action))
  })
})

describe('professions', () => {
  test('an add creates <id>:0 with zeroed progress', () => {
    const c = reduceCollections(makeCharacter(), act('F1', { kind: 'profession:add', profession: { name: 'Smith', rank: 2 } }))
    assert.deepEqual(c.professions, [{ id: 'F1:0', name: 'Smith', rank: 2, challenges: 0, missions: 0, practiceWeeks: 0, rerollOnes: false }])
  })

  test('edit changes named fields; unknown id → not_found; remove by id', () => {
    const base = reduceCollections(makeCharacter(), act('F2', { kind: 'profession:add', profession: { name: 'Smith' } }))
    const c = reduceCollections(base, act('F3', { kind: 'profession:edit', profession: { id: 'F2:0', rank: 3, challenges: 1 } }))
    assert.deepEqual(c.professions[0], { id: 'F2:0', name: 'Smith', rank: 3, challenges: 1, missions: 0, practiceWeeks: 0, rerollOnes: false })
    assert.throws(() => reduceCollections(base, act('F4', { kind: 'profession:edit', profession: { id: 'nope', rank: 1 } })), notFound)
    assert.throws(() => reduceCollections(base, act('F4', { kind: 'profession:remove', professionId: 'nope' })), notFound)
    assert.deepEqual(reduceCollections(base, act('F5', { kind: 'profession:remove', professionId: 'F2:0' })).professions, [])
  })

  test('rank outside 0–7 or fractional, and negative counters → invalid_amount', () => {
    const add = (profession: { name: string; rank?: number; challenges?: number }) => () => reduceCollections(makeCharacter(), act('F6', { kind: 'profession:add', profession }))
    assert.throws(add({ name: 'x', rank: 8 }), invalidAmount)
    assert.throws(add({ name: 'x', rank: -1 }), invalidAmount)
    assert.throws(add({ name: 'x', rank: 1.5 }), invalidAmount)
    assert.throws(add({ name: 'x', challenges: -1 }), invalidAmount)
    assert.equal(add({ name: 'x', rank: 7 })().professions[0]!.rank, 7)
  })
})

describe('identity, notes, race effects, attunements', () => {
  test('identity:set merges the named fields', () => {
    const c = reduceCollections(makeCharacter(), act('G1', { kind: 'identity:set', identity: { name: 'Kaelen', pronouns: 'they/them' } }))
    assert.equal(c.identity.name, 'Kaelen')
    assert.equal(c.identity.pronouns, 'they/them')
    assert.equal(c.identity.ageCategory, 'adult')
  })

  test('identity:set ignores age category and age benefits even if a client sends them', () => {
    const sneaky = { name: 'Z', ageCategory: 'elderly', ageBenefits: ['x'] } as unknown as { name: string }
    const c = reduceCollections(makeCharacter(), act('G5', { kind: 'identity:set', identity: sneaky }))
    assert.equal(c.identity.name, 'Z')
    assert.equal(c.identity.ageCategory, 'adult')
    assert.deepEqual(c.identity.ageBenefits, [])
  })

  test('notes:set replaces the notes', () => {
    assert.equal(reduceCollections(makeCharacter({ notes: 'old' }), act('G2', { kind: 'notes:set', notes: 'new' })).notes, 'new')
  })

  test('raceEffects:set and attunement:set replace the whole list', () => {
    const c0 = makeCharacter({ raceEffects: [{ kind: 'manual', text: 'old' }], attunements: [{ id: 'race:0', element: 'fire', level: 'basic', source: 'race' }] })
    const c1 = reduceCollections(c0, act('G3', { kind: 'raceEffects:set', effects: [{ kind: 'awardBonus', per: 7, bonus: 1 }] }))
    assert.deepEqual(c1.raceEffects, [{ kind: 'awardBonus', per: 7, bonus: 1 }])
    const c2 = reduceCollections(c1, act('G4', { kind: 'attunement:set', attunements: [{ id: 'G4:0', element: 'water', level: 'advanced', source: 'p1' }] }))
    assert.deepEqual(c2.attunements, [{ id: 'G4:0', element: 'water', level: 'advanced', source: 'p1' }])
  })
})

describe('purity and determinism', () => {
  const actions: CollectionAction[] = [
    act('H1', { kind: 'gear:weapon:add', weapon: { ...newWeapon, wielded: true } }),
    act('H2', { kind: 'gear:item:add', item: { name: 'Rope', slots: 1, quantity: 1, notes: '' } }),
    act('H3', { kind: 'gear:coins:set', coins: { iron: 5 } }),
    act('H5', { kind: 'profession:add', profession: { name: 'Smith' } }),
    act('H6', { kind: 'identity:set', identity: { name: 'Z' } }),
    act('H7', { kind: 'notes:set', notes: 'n' }),
    act('H8', { kind: 'gear:wear', piece: 'armor', worn: true }),
  ]
  test('reducers never mutate their input and give deep-equal results for the same input', () => {
    for (const a of actions) {
      const frozen = deepFreeze(makeCharacter())
      const once = reduceCollections(frozen, a)
      assert.deepEqual(once, reduceCollections(makeCharacter(), a), a.kind)
      assert.notEqual(once, frozen)
    }
  })
  test('isCollectionAction recognises exactly the collection kinds', () => {
    for (const a of actions) assert.ok(isCollectionAction(a), a.kind)
    assert.ok(!isCollectionAction({ id: 'x', at, kind: 'damage', amount: 1 }))
    assert.ok(!isCollectionAction({ id: 'x', at, kind: 'xp:buy', purchase: 'hp' }))
  })
})
