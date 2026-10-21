import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rollSpec, roll, rerollComplication, formatRoll, focusDie, rerollOnes, onesToReroll } from '../src/dice'
import { makeCharacter, conditions, condition, weapon } from './fixtures'
import { CONDITION } from '../src/conditions'

function seeded(...values: number[]) {
  let index = 0
  return (sides: number) => {
    const value = values[index++]
    assert.ok(value !== undefined && value >= 1 && value <= sides, `die ${index}: ${value} must fit d${sides}`)
    return value
  }
}

const basic = () => rollSpec(makeCharacter(), { type: 'check', ability: 'might' }, conditions)

test('9: d8 heart 5 + d6 Might 4 + 2 = 11', () => {
  const result = roll(basic(), { modifier: 2, net: 0 }, seeded(5, 4))
  assert.equal(result.total, 11)
  assert.equal(result.complication, 'none')
  assert.equal(formatRoll(result), 'Might check: heart d8 5 + d6 4 + 2 = 11')
})

test('9: A1 adds d6 and drops lowest; D1 adds d8 and drops highest; A2+D1 nets A1', () => {
  const advantage = roll(basic(), { modifier: 0, net: 1 }, seeded(5, 4, 1))
  assert.deepEqual(advantage.dice.map(d => [d.sides, d.value, d.dropped]), [[8, 5, false], [6, 4, false], [6, 1, true]])
  assert.equal(advantage.total, 9)
  assert.match(formatRoll(advantage), /A1 dropped d6 1/)
  const disadvantage = roll(basic(), { modifier: 0, net: -1 }, seeded(5, 4, 7))
  assert.deepEqual(disadvantage.dice.map(d => [d.sides, d.dropped]), [[8, false], [6, false], [8, true]])
  assert.equal(disadvantage.total, 9)
  assert.equal(roll(basic(), { modifier: 0, net: 2 - 1 }, seeded(5, 4, 3)).dice.length, 3)
})

test('10: Weakened 2 starts Might at D2', () => {
  const c = makeCharacter({ conditions: [condition(CONDITION.weakened, 2)] })
  assert.equal(rollSpec(c, { type: 'check', ability: 'might' }, conditions).defaultNet, -2)
})

test('11: exactly one kept 1 has a choice; reroll once, even if another 1', () => {
  const pending = roll(basic(), { modifier: 0, net: 0 }, seeded(1, 4))
  assert.equal(pending.complication, 'pending')
  assert.equal(pending.automaticFailure, false)
  const completed = rerollComplication(pending, seeded(1))
  assert.equal(completed.complication, 'rerolled')
  assert.equal(completed.dice[0]?.rerolled, 1)
  assert.equal(completed.total, 5)
  assert.notEqual(completed, pending)
  assert.equal(pending.complication, 'pending')
  assert.throws(() => rerollComplication(completed, seeded(2)))
})

test('11/S12: two kept 1s fail automatically; dropped 1 does not trigger', () => {
  const failed = roll(basic(), { modifier: 0, net: 0 }, seeded(1, 1))
  assert.equal(failed.automaticFailure, true)
  assert.equal(failed.complication, 'failed')
  assert.throws(() => rerollComplication(failed, seeded(2)))
  const dropped = roll(basic(), { modifier: 0, net: 1 }, seeded(5, 4, 1))
  assert.equal(dropped.complication, 'none')
})

test('12: saving throws with kept 1 have no complication', () => {
  const result = roll(rollSpec(makeCharacter(), { type: 'save', ability: 'might' }, conditions), { modifier: 0, net: 0 }, seeded(1, 4))
  assert.equal(result.complication, 'none')
})

test('13: Cunning heavy piercing bow adds 2d12; defense bonus 9 is flat', () => {
  const c = makeCharacter({ gear: { ...makeCharacter().gear, weapons: [weapon({ size: 'H', damageType: 'P' })], armor: { name: 'plate', weight: 'H', misc: 1, worn: true }, shield: { name: 'shield', weight: 'L', misc: 1, worn: true } } })
  const attack = rollSpec(c, { type: 'attack', ability: 'cunning' }, conditions)
  assert.deepEqual(attack.dice, [{ sides: 8, role: 'heart' }, { sides: 6, role: 'ability' }, { sides: 12, role: 'weapon' }, { sides: 12, role: 'weapon' }])
  assert.equal(roll(attack, { modifier: 0, net: 0 }, seeded(5, 4, 7, 8)).total, 24)
  const defense = rollSpec(c, { type: 'defense', ability: 'might' }, conditions)
  assert.equal(defense.flat, 9)
  assert.equal(roll(defense, { modifier: 0, net: 0 }, seeded(5, 4)).total, 18)
  assert.equal(attack.complicationRule, false)
  assert.equal(defense.complicationRule, false)
})

test('9–13: roll and reroll never mutate the character or roll spec', () => {
  const c = makeCharacter()
  const before = structuredClone(c)
  const spec = rollSpec(c, { type: 'check', ability: 'might' }, conditions)
  const specBefore = structuredClone(spec)
  const result = roll(spec, { modifier: 0, net: 0 }, seeded(1, 4))
  rerollComplication(result, seeded(6))
  assert.deepEqual(c, before)
  assert.deepEqual(spec, specBefore)
})

test('combat stance excludes Presence; invalid rolls fail rather than inventing dice', () => {
  assert.throws(() => rollSpec(makeCharacter(), { type: 'attack', ability: 'presence' }, conditions), { name: 'RuleError', code: 'bad_roll' })
  assert.throws(() => roll(basic(), { modifier: 0, net: 0 }, () => 9))
})

test('Focus: the chosen kept die becomes its maximum and the total follows; once per roll; a dropped die is refused', () => {
  const rolled = roll(basic(), { modifier: 2, net: 1 }, seeded(3, 2, 1))
  const focused = focusDie(rolled, 0)
  assert.deepEqual(focused.dice[0], { sides: 8, role: 'heart', value: 8, dropped: false, focused: 3 })
  assert.equal(focused.total, rolled.total + 5)
  assert.equal(rolled.dice[0]?.value, 3)
  assert.throws(() => focusDie(focused, 1))
  assert.throws(() => focusDie(rolled, 2))
  assert.throws(() => focusDie(rolled, 9))
})

test('Focus waits for a pending complication choice; after Fail or the reroll it applies', () => {
  const pending = roll(basic(), { modifier: 0, net: 0 }, seeded(1, 4))
  assert.throws(() => focusDie(pending, 1), { name: 'RuleError', code: 'bad_roll' })
  const failed = focusDie({ ...pending, complication: 'failed' }, 1)
  assert.equal(failed.total, 7)
  assert.equal(failed.complication, 'failed')
  const rerolled = focusDie(rerollComplication(pending, seeded(2)), 0)
  assert.equal(rerolled.total, 12)
  assert.equal(rerolled.complication, 'rerolled')
})

test('Wisdom of Experience: every kept 1 rerolls, no complication, a 1 on the reroll stands', () => {
  const double = roll(basic(), { modifier: 0, net: 0 }, seeded(1, 1))
  assert.equal(double.automaticFailure, true)
  const rerolled = rerollOnes(double, seeded(1, 5))
  assert.deepEqual(rerolled.dice.map(d => [d.value, d.rerolled]), [[1, 1], [5, 5]])
  assert.equal(rerolled.complication, 'none')
  assert.equal(rerolled.automaticFailure, false)
  assert.equal(rerolled.total, 6)
  assert.deepEqual(onesToReroll(rerolled), [])
  assert.throws(() => rerollOnes(rerolled, seeded(2)))
  const pending = roll(basic(), { modifier: 1, net: 0 }, seeded(4, 1))
  const once = rerollOnes(pending, seeded(3))
  assert.equal(once.complication, 'none')
  assert.equal(once.total, 8)
})

test('Wisdom of Experience: only on a check, and not after the 1 was settled by Fail or a complication reroll', () => {
  const save = roll(rollSpec(makeCharacter(), { type: 'save', ability: 'might' }, conditions), { modifier: 0, net: 0 }, seeded(1, 4))
  assert.deepEqual(onesToReroll(save), [])
  assert.throws(() => rerollOnes(save, seeded(2)))
  const pending = roll(basic(), { modifier: 0, net: 0 }, seeded(1, 4))
  assert.throws(() => rerollOnes(rerollComplication(pending, seeded(1)), seeded(2)))
  assert.throws(() => rerollOnes({ ...pending, complication: 'failed' }, seeded(2)))
})
