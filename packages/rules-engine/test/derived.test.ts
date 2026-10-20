import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  weaponDice, defenseBonus, speed, disadvantage, situational, woundPenalty, maxHp, effectiveMaxHp,
  deathThreshold, maxHeartDie, slotCapacity, slotsUsed, minorUseCost,
} from '../src/derived'
import { CONDITION } from '../src/conditions'
import type { Character, Die, Purchase } from '../src/types'
import { makeCharacter, weapon, condition, conditions } from './fixtures'

const withGear = (gear: Partial<Character['gear']>, over: Partial<Character> = {}) => {
  const c = makeCharacter(over)
  return { ...c, gear: { ...c.gear, ...gear } }
}
const hpPurchase = (i: number): Purchase => ({ id: `p${i}`, kind: 'hp', target: null, cost: 5 + i, at: '2026-01-01T00:00:00Z' })

describe('criterion 1: weaponDice', () => {
  test('heavy piercing bow: might 1d12, agility 1d12, cunning 2d12', () => {
    const c = withGear({ weapons: [weapon({ size: 'H', damageType: 'P' })] })
    assert.equal(weaponDice(c, 'might'), '1d12')
    assert.equal(weaponDice(c, 'agility'), '1d12')
    assert.equal(weaponDice(c, 'cunning'), '2d12')
  })
  test('heavy bludgeoning misc 2: might 2d12+2', () => {
    const c = withGear({ weapons: [weapon({ size: 'H', damageType: 'B', misc: 2 })] })
    assert.equal(weaponDice(c, 'might'), '2d12+2')
  })
  test('light slashing: agility 2d8, might 1d8', () => {
    const c = withGear({ weapons: [weapon({ size: 'L', damageType: 'S' })] })
    assert.equal(weaponDice(c, 'agility'), '2d8')
    assert.equal(weaponDice(c, 'might'), '1d8')
  })
  test('ultralight piercing misc 1: cunning 2d4+1', () => {
    const c = withGear({ weapons: [weapon({ size: 'UL', damageType: 'P', misc: 1 })] })
    assert.equal(weaponDice(c, 'cunning'), '2d4+1')
  })
  test('no wielded weapon: null (an unwielded weapon does not count)', () => {
    assert.equal(weaponDice(makeCharacter(), 'might'), null)
    assert.equal(weaponDice(withGear({ weapons: [weapon({ wielded: false })] }), 'might'), null)
  })
})

describe('criterion 2: defenseBonus', () => {
  // The design's criterion 2 says 9, but its own formula and worked line (6+1+1+2) give 10.
  test('heavy armor misc 1 + light shield misc 2 → 10 (6+1 armor, 1+2 shield)', () => {
    const c = withGear({
      armor: { name: '', weight: 'H', misc: 1, worn: true },
      shield: { name: '', weight: 'L', misc: 2, worn: true },
    })
    assert.equal(defenseBonus(c), 10)
  })
  test('leather worn, no shield → 2', () => {
    assert.equal(defenseBonus(withGear({ armor: { name: '', weight: 'L', misc: 0, worn: true } })), 2)
  })
  test('armor not worn → 0', () => {
    assert.equal(defenseBonus(withGear({ armor: { name: '', weight: 'H', misc: 3, worn: false } })), 0)
  })
})

describe('criterion 3: speed', () => {
  test('60 + heavy wielded weapon → 55', () => {
    assert.equal(speed(withGear({ weapons: [weapon({ size: 'H' })] })), 55)
  })
  test('60 + H armor + H shield + heavy weapon + Slowed → 15', () => {
    const c = withGear(
      {
        weapons: [weapon({ size: 'H' })],
        armor: { name: '', weight: 'H', misc: 0, worn: true },
        shield: { name: '', weight: 'H', misc: 0, worn: true },
      },
      { conditions: [condition(CONDITION.slowed, 1)] },
    )
    assert.equal(speed(c), 15)
  })
  test('elderly 40 + light armor → 35', () => {
    const c = withGear({ armor: { name: '', weight: 'L', misc: 0, worn: true } })
    c.play.baseSpeed = 40
    assert.equal(speed(c), 35)
  })
  test('Restrained → 0', () => {
    assert.equal(speed(makeCharacter({ conditions: [condition(CONDITION.restrained, 1)] })), 0)
  })
  test('Crippled → 5', () => {
    assert.equal(speed(makeCharacter({ conditions: [condition(CONDITION.crippled, null)] })), 5)
  })
  test('an unworn heavy shield and an unwielded heavy weapon cost nothing', () => {
    const c = withGear({
      weapons: [weapon({ size: 'H', wielded: false })],
      shield: { name: '', weight: 'H', misc: 0, worn: false },
    })
    assert.equal(speed(c), 60)
  })
})

describe('criterion 4: disadvantage', () => {
  const all = (c: Character) => ({
    might: disadvantage(c, 'might', conditions),
    agility: disadvantage(c, 'agility', conditions),
    cunning: disadvantage(c, 'cunning', conditions),
    presence: disadvantage(c, 'presence', conditions),
  })
  test('Weakened 2 + Poisoned 1 → might 3, agility 1, cunning 1, presence 1', () => {
    const c = makeCharacter({ conditions: [condition(CONDITION.weakened, 2), condition(CONDITION.poisoned, 1)] })
    assert.deepEqual(all(c), { might: 3, agility: 1, cunning: 1, presence: 1 })
  })
  test('Blinded 1 + Weakened 1 → might 1, others 0; situational lists Blinded text', () => {
    const c = makeCharacter({ conditions: [condition('player.conditions~blinded', 1), condition(CONDITION.weakened, 1)] })
    assert.deepEqual(all(c), { might: 1, agility: 0, cunning: 0, presence: 0 })
    const lines = situational(c, conditions)
    assert.equal(lines.length, 1)
    assert.equal(lines[0].title, 'Blinded')
    assert.equal(lines[0].text, conditions.get('player.conditions~blinded')!.situational)
  })
  test('Aggravated 2 → all 0, its text listed', () => {
    const c = makeCharacter({ conditions: [condition('player.conditions~aggravated', 2)] })
    assert.deepEqual(all(c), { might: 0, agility: 0, cunning: 0, presence: 0 })
    assert.deepEqual(situational(c, conditions).map(l => l.title), ['Aggravated'])
  })
  test('a custom condition counts only for the abilities it affects', () => {
    const c = makeCharacter({
      conditions: [condition('', 2, { conditionId: null, name: 'Cursed', permanent: true, affects: ['presence', 'cunning'] })],
    })
    assert.deepEqual(all(c), { might: 0, agility: 0, cunning: 2, presence: 2 })
  })
})

describe('criterion 5: HP', () => {
  const wound = (id: string, rank: number) => ({ id, rank, description: '', treated: false, takenAt: '2026-01-01T00:00:00Z' })
  test('base 40, wounds 2 and 3 → penalty 5, effective max 35', () => {
    const c = makeCharacter({ wounds: [wound('a', 2), wound('b', 3)] })
    assert.equal(woundPenalty(c), 5)
    assert.equal(effectiveMaxHp(c), 35)
  })
  test('a rank-12 wound → effective max 28', () => {
    assert.equal(effectiveMaxHp(makeCharacter({ wounds: [wound('a', 12)] })), 28)
  })
  test('3 HP purchases → max 70, death threshold −70 (wounds do not move it)', () => {
    const c = makeCharacter({
      xp: { awarded: 100, purchases: [hpPurchase(0), hpPurchase(1), hpPurchase(2)] },
      wounds: [wound('a', 12)],
    })
    assert.equal(maxHp(c), 70)
    assert.equal(deathThreshold(c), -70)
  })
  test('only hp purchases raise max HP', () => {
    const c = makeCharacter({ xp: { awarded: 10, purchases: [{ ...hpPurchase(0), kind: 'die' }] } })
    assert.equal(maxHp(c), 40)
  })
})

describe('criterion 6: maxHeartDie', () => {
  test('30 → 8, 199 → 8, 200 → 10, 500 → 12, 1000 → 20', () => {
    const at = (awarded: number) => maxHeartDie(makeCharacter({ xp: { awarded, purchases: [] } }))
    assert.deepEqual([30, 199, 200, 500, 1000].map(at), [8, 8, 10, 12, 20])
  })
})

describe('criterion 7: slots', () => {
  const might = (d: Die) => {
    const c = makeCharacter()
    c.abilities.might.current = d
    return c
  }
  test('slotCapacity: d4 → 8, d6 → 9, d12 → 12', () => {
    assert.deepEqual(([4, 6, 12] as Die[]).map(d => slotCapacity(might(d))), [8, 9, 12])
  })
  test('slotsUsed: heavy bow + leather + 3 rations → 6 (of 9)', () => {
    const c = withGear({
      weapons: [weapon({ size: 'H', damageType: 'P' })],
      armor: { name: '', weight: 'L', misc: 0, worn: true },
      items: [{ id: 'i1', name: 'Rations', slots: 1, quantity: 3, notes: '' }],
    })
    assert.equal(slotsUsed(c), 6)
    assert.equal(slotCapacity(c), 9)
  })
  test('an ultralight weapon takes 0.2 slot; a shield takes 1', () => {
    const c = withGear({ weapons: [weapon({ size: 'UL' })], shield: { name: '', weight: 'L', misc: 0, worn: false } })
    assert.equal(slotsUsed(c), 1.2)
  })
})

describe('minorUseCost', () => {
  test('the n-th use this fight costs n', () => {
    assert.equal(minorUseCost({ usesThisFight: 0 }), 1)
    assert.equal(minorUseCost({ usesThisFight: 1 }), 2)
  })
})
