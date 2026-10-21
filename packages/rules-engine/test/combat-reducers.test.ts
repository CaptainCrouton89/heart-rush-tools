import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import * as r from '../src/reducers/combat'
import { deathThreshold, effectiveMaxHp, maxHeartDie } from '../src/derived'
import { CONDITION } from '../src/conditions'
import { applyAction, applyInverse, upgradeCharacter } from '../src/actions'
import { RuleError, type Action, type ActionBody, type Aspect, type Character, type ClientAction, type Condition, type Talent } from '../src/types'
import { makeCharacter, condition, conditions } from './fixtures'

const AT = '2026-01-01T00:00:00.000Z'
type BodyOf<K extends ActionBody['kind']> = Extract<ActionBody, { kind: K }> | (Extract<ActionBody, { kind: 'rush:set' | 'dp:set' | 'round:set' }> & { kind: K })
const act = <K extends ActionBody['kind']>(body: BodyOf<K>, id = 'A1'): BodyOf<K> & { id: string; at: string } =>
  ({ id, at: AT, ...body })

const refuses = (code: string, fn: () => unknown) =>
  assert.throws(fn, (e: unknown) => e instanceof RuleError && e.code === code, `expected RuleError(${code})`)

const talent = (over: Partial<Talent> = {}): Talent => ({
  id: 't1', catalogueId: null, titleSnapshot: 'Talent', category: 'combat', frequency: 'minor', destiny: false,
  customText: null, usedThisPeriod: false, usesThisFight: 0, ...over,
})
const withPlay = (c: Character, play: Partial<Character['play']>): Character => ({ ...c, play: { ...c.play, ...play } })
const sleepRow = (conditionId: string, over: Partial<Condition> = {}) => condition(conditionId, 1, { source: 'sleep', ...over })

describe('criterion 10: damage, wounds, heal', () => {
  test('damage 12 on 40/40: hp 28, one untreated wound of rank 12, effective max 28', () => {
    const c = r.damage(makeCharacter(), act({ kind: 'damage', amount: 12, woundDescription: 'fractured leg' }))
    assert.equal(c.hp.current, 28)
    assert.deepEqual(c.wounds, [{ id: 'A1:0', rank: 12, description: 'fractured leg', treated: false, takenAt: AT }])
    assert.equal(effectiveMaxHp(c), 28)
  })
  test('a wound is always added at 10 or more, with a blank description when none is given; 9 adds none', () => {
    const ten = r.damage(makeCharacter(), act({ kind: 'damage', amount: 10 }))
    assert.equal(ten.wounds.length, 1)
    assert.equal(ten.wounds[0]!.description, '')
    assert.equal(r.damage(makeCharacter(), act({ kind: 'damage', amount: 9 })).wounds.length, 0)
  })
  test('hp may go negative; damage does not clamp', () => {
    const c = r.damage(makeCharacter({ hp: { baseMax: 40, current: 3, heartDieCurrent: 8 } }), act({ kind: 'damage', amount: 8 }))
    assert.equal(c.hp.current, -5)
  })
  test('the full worked example: treat 7 → rank 5 treated; long rest → rank 4, hp 36; damage 9 → 27; heal 20 → 36', () => {
    let c = r.damage(makeCharacter(), act({ kind: 'damage', amount: 12, woundDescription: 'fractured leg' }, 'A1'))
    c = r.woundTreat(c, act({ kind: 'wound:treat', woundId: 'A1:0', medicineRoll: 7 }, 'A2'))
    assert.equal(c.wounds[0]!.rank, 5)
    assert.equal(c.wounds[0]!.treated, true)
    c = r.longRest(c, act({ kind: 'longRest', successful: true }, 'A3'))
    assert.equal(c.wounds[0]!.rank, 4)
    assert.equal(c.hp.current, 36)
    c = r.damage(c, act({ kind: 'damage', amount: 9 }, 'A4'))
    assert.equal(c.hp.current, 27)
    assert.equal(c.wounds.length, 1)
    c = r.heal(c, act({ kind: 'heal', amount: 20 }, 'A5'))
    assert.equal(c.hp.current, 36)
  })
  test('Endure: the player halves 12 to 6 and enters 6 → no wound', () => {
    const c = r.damage(makeCharacter(), act({ kind: 'damage', amount: 6 }))
    assert.equal(c.hp.current, 34)
    assert.equal(c.wounds.length, 0)
  })
  test('wound:remove on the rank-4 wound → effective max 40', () => {
    const c = makeCharacter({ wounds: [{ id: 'w', rank: 4, description: '', treated: true, takenAt: AT }], hp: { baseMax: 40, current: 36, heartDieCurrent: 8 } })
    assert.equal(effectiveMaxHp(c), 36)
    assert.equal(effectiveMaxHp(r.woundRemove(c, act({ kind: 'wound:remove', woundId: 'w' }))), 40)
  })
  test('heal never lowers hp and never passes the effective maximum', () => {
    const c = makeCharacter({ hp: { baseMax: 40, current: 30, heartDieCurrent: 8 } })
    assert.equal(r.heal(c, act({ kind: 'heal', amount: 5 })).hp.current, 35)
    assert.equal(r.heal(c, act({ kind: 'heal', amount: 500 })).hp.current, 40)
    const down = makeCharacter({ hp: { baseMax: 40, current: -4, heartDieCurrent: 8 } })
    assert.equal(r.heal(down, act({ kind: 'heal', amount: 10 })).hp.current, 6)
  })
  test('invalid amounts are refused', () => {
    for (const amount of [0, -3, 1.5, Number.NaN]) {
      refuses('invalid_amount', () => r.damage(makeCharacter(), act({ kind: 'damage', amount })))
      refuses('invalid_amount', () => r.heal(makeCharacter(), act({ kind: 'heal', amount })))
    }
  })
  test('setHp sets an integer up to the effective maximum, negatives allowed', () => {
    assert.equal(r.setHp(makeCharacter(), act({ kind: 'setHp', value: 12 })).hp.current, 12)
    assert.equal(r.setHp(makeCharacter(), act({ kind: 'setHp', value: -7 })).hp.current, -7)
    refuses('invalid_amount', () => r.setHp(makeCharacter(), act({ kind: 'setHp', value: 41 })))
    refuses('invalid_amount', () => r.setHp(makeCharacter(), act({ kind: 'setHp', value: 1.5 })))
  })
  test('wound:add creates <id>:0; wound:edit changes fields; both validate rank', () => {
    let c = r.woundAdd(makeCharacter(), act({ kind: 'wound:add', wound: { rank: 3, description: 'gash' } }, 'W1'))
    assert.deepEqual(c.wounds, [{ id: 'W1:0', rank: 3, description: 'gash', treated: false, takenAt: AT }])
    c = r.woundEdit(c, act({ kind: 'wound:edit', wound: { id: 'W1:0', rank: 5, treated: true } }, 'W2'))
    assert.equal(c.wounds[0]!.rank, 5)
    assert.equal(c.wounds[0]!.treated, true)
    assert.equal(c.wounds[0]!.description, 'gash')
    refuses('invalid_amount', () => r.woundAdd(makeCharacter(), act({ kind: 'wound:add', wound: { rank: 0 } })))
    refuses('invalid_amount', () => r.woundEdit(c, act({ kind: 'wound:edit', wound: { id: 'W1:0', rank: 0 } })))
  })
  test('wound:treat: a roll at or above the rank removes the wound; a treated wound cannot be treated again; unknown id → not_found', () => {
    const c = makeCharacter({ wounds: [
      { id: 'a', rank: 4, description: '', treated: false, takenAt: AT },
      { id: 'b', rank: 6, description: '', treated: true, takenAt: AT },
    ] })
    assert.deepEqual(r.woundTreat(c, act({ kind: 'wound:treat', woundId: 'a', medicineRoll: 4 })).wounds.map(w => w.id), ['b'])
    assert.deepEqual(r.woundTreat(c, act({ kind: 'wound:treat', woundId: 'a', medicineRoll: 9 })).wounds.map(w => w.id), ['b'])
    refuses('bad_action', () => r.woundTreat(c, act({ kind: 'wound:treat', woundId: 'b', medicineRoll: 2 })))
    refuses('not_found', () => r.woundTreat(c, act({ kind: 'wound:treat', woundId: 'zz', medicineRoll: 2 })))
    refuses('invalid_amount', () => r.woundTreat(c, act({ kind: 'wound:treat', woundId: 'a', medicineRoll: -1 })))
    refuses('not_found', () => r.woundRemove(c, act({ kind: 'wound:remove', woundId: 'zz' })))
    refuses('not_found', () => r.woundEdit(c, act({ kind: 'wound:edit', wound: { id: 'zz', rank: 2 } })))
  })
})

describe('criterion 10b: sleep conditions', () => {
  test('the design sequence', () => {
    let c = makeCharacter({ conditions: [condition(CONDITION.weakened, 1, { id: 'm1' })] })
    // night 1: one roll
    c = r.longRest(c, act({ kind: 'longRest', successful: false, rolled: ['dazed'] }, 'N1'))
    assert.equal(c.play.failedRestStreak, 1)
    assert.deepEqual(c.conditions.filter(k => k.source === 'sleep').map(k => [k.id, k.conditionId, k.level]), [['N1:0', CONDITION.dazed, 1]])
    // night 2: two rolls
    c = r.longRest(c, act({ kind: 'longRest', successful: false, rolled: ['weakened', 'off-balanced'] }, 'N2'))
    assert.equal(c.play.failedRestStreak, 2)
    const level = (id: string, source: Condition['source']) => c.conditions.filter(k => k.conditionId === id && k.source === source).reduce((n, k) => n + (k.level ?? 0), 0)
    assert.equal(level(CONDITION.weakened, 'manual') + level(CONDITION.weakened, 'sleep'), 2)
    assert.equal(level(CONDITION.weakened, 'sleep'), 1)
    assert.equal(level(CONDITION.offBalanced, 'sleep'), 1)
    // night 3 with streak 2: one roll accepted; two refused
    refuses('wrong_rolled_count', () => r.longRest(c, act({ kind: 'longRest', successful: false, rolled: ['dazed', 'weakened'] }, 'N3')))
    c = r.longRest(c, act({ kind: 'longRest', successful: false, rolled: ['dazed'] }, 'N3'))
    assert.equal(c.play.failedRestStreak, 3)
    // success: sleep rows go, the manual Weakened 1 stays, streak back to 0
    c = r.longRest(c, act({ kind: 'longRest', successful: true }, 'N4'))
    assert.deepEqual(c.conditions.map(k => [k.id, k.conditionId, k.level, k.source]), [['m1', CONDITION.weakened, 1, 'manual']])
    assert.equal(c.play.failedRestStreak, 0)
  })
  test('failed rest ignores levels beyond the condition cap of five, including duplicate rolls in one night', () => {
    const five = makeCharacter({ conditions: [condition(CONDITION.weakened, 5, { id: 'manual' })] })
    const atCap = r.longRest(five, act({ kind: 'longRest', successful: false, rolled: ['weakened'] }, 'F1'))
    assert.deepEqual(atCap.conditions.map(k => k.id), ['manual'])
    const four = withPlay(makeCharacter({ conditions: [condition(CONDITION.weakened, 4, { id: 'manual' })] }), { failedRestStreak: 1 })
    const twice = r.longRest(four, act({ kind: 'longRest', successful: false, rolled: ['weakened', 'weakened'] }, 'F2'))
    assert.deepEqual(twice.conditions.map(k => [k.id, k.level]), [['manual', 4], ['F2:0', 1]])
  })
  test('condition:set clamps the manual row against the five-level aggregate, not only its own level', () => {
    const c = makeCharacter({ conditions: [sleepRow(CONDITION.weakened, { id: 'sleep', level: 3 })] })
    const after = r.conditionSet(c, act({ kind: 'condition:set', conditionId: CONDITION.weakened, level: 5 }, 'C7'))
    assert.deepEqual(after.conditions.map(k => [k.id, k.level]), [['sleep', 3], ['C7:0', 2]])
  })
  test('longRest failed with two rolled creates conditions <id>:0 and <id>:1', () => {
    const c0 = withPlay(makeCharacter(), { failedRestStreak: 1 })
    const c = r.longRest(c0, act({ kind: 'longRest', successful: false, rolled: ['weakened', 'dazed'] }, 'R9'))
    assert.deepEqual(c.conditions.map(k => [k.id, k.conditionId, k.level, k.source, k.permanent]), [
      ['R9:0', CONDITION.weakened, 1, 'sleep', false],
      ['R9:1', CONDITION.dazed, 1, 'sleep', false],
    ])
  })
  test('required count: 1 at streak 0, 2 at streak 1, 1 at streak 2 and beyond', () => {
    const rolled2 = ['dazed', 'weakened'] as ['dazed', 'weakened']
    const rolled1 = ['dazed'] as ['dazed']
    const run = (streak: number, rolled: Array<'weakened' | 'off-balanced' | 'dazed'>) =>
      r.longRest(withPlay(makeCharacter(), { failedRestStreak: streak }), act({ kind: 'longRest', successful: false, rolled }))
    refuses('wrong_rolled_count', () => run(0, rolled2))
    refuses('wrong_rolled_count', () => run(0, []))
    refuses('wrong_rolled_count', () => run(1, rolled1))
    refuses('wrong_rolled_count', () => run(2, rolled2))
    refuses('wrong_rolled_count', () => run(5, rolled2))
    assert.equal(run(0, rolled1).play.failedRestStreak, 1)
    assert.equal(run(1, rolled2).play.failedRestStreak, 2)
    assert.equal(run(2, rolled1).play.failedRestStreak, 3)
    assert.equal(run(5, rolled1).play.failedRestStreak, 6)
    refuses('bad_action', () => run(0, ['burning' as 'dazed']))
  })
  test('rulebook example: 14 hp, d4 heart die, rank 12 wound; failed → 21 hp and Dazed; successful next → wound 11, hp 29, Dazed gone', () => {
    let c = makeCharacter({
      hp: { baseMax: 40, current: 14, heartDieCurrent: 4 },
      wounds: [{ id: 'w', rank: 12, description: '', treated: false, takenAt: AT }],
    })
    c = r.longRest(c, act({ kind: 'longRest', successful: false, rolled: ['dazed'] }, 'F1'))
    assert.equal(c.hp.current, 21)
    assert.equal(c.hp.heartDieCurrent, 8)
    assert.equal(c.wounds[0]!.rank, 12)
    c = r.longRest(c, act({ kind: 'longRest', successful: true }, 'F2'))
    assert.equal(c.wounds[0]!.rank, 11)
    assert.equal(c.hp.current, 29)
    assert.equal(c.conditions.length, 0)
  })
  test('failed rest heals half the missing hp, rounded down, and never lowers hp', () => {
    const c = makeCharacter({ hp: { baseMax: 40, current: 25, heartDieCurrent: 8 } })
    assert.equal(r.longRest(c, act({ kind: 'longRest', successful: false, rolled: ['dazed'] })).hp.current, 32) // missing 15 → +7
    const full = makeCharacter()
    assert.equal(r.longRest(full, act({ kind: 'longRest', successful: false, rolled: ['dazed'] })).hp.current, 40)
  })
  test('a wound of rank 1 is removed by a successful long rest; a major ability resets, other frequencies do not', () => {
    const c = makeCharacter({
      wounds: [{ id: 'w', rank: 1, description: '', treated: false, takenAt: AT }],
      talents: [
        talent({ id: 'maj', frequency: 'major', usedThisPeriod: true }),
        talent({ id: 'wk', frequency: 'weekly', usedThisPeriod: true }),
        talent({ id: 'mo', frequency: 'monthly', usedThisPeriod: true }),
      ],
    })
    const after = r.longRest(c, act({ kind: 'longRest', successful: true }))
    assert.equal(after.wounds.length, 0)
    assert.deepEqual(after.talents.map(t => [t.id, t.usedThisPeriod]), [['maj', false], ['wk', true], ['mo', true]])
  })
})

describe('criterion 11: nextRound', () => {
  test('Weakened 2 fading, Burning 1 fading, custom permanent 3 → Weakened 1, Burning gone, custom 3, round +1', () => {
    const c = makeCharacter({
      conditions: [
        condition(CONDITION.weakened, 2, { id: 'a' }),
        condition(CONDITION.burning, 1, { id: 'b' }),
        condition(null as unknown as string, 3, { id: 'cu', conditionId: null, name: 'Cursed', permanent: true, affects: ['might'] }),
      ],
    })
    const after = r.nextRound(c, act({ kind: 'nextRound' }), conditions)
    assert.deepEqual(after.conditions.map(k => [k.id, k.level]), [['a', 1], ['cu', 3]])
    assert.equal(after.play.round, 2)
  })
  test('a permanent catalogue condition is kept; a non-fading one is kept; only one aggregate level fades, sleep first', () => {
    const c = makeCharacter({
      conditions: [
        condition(CONDITION.weakened, 3, { id: 'perm', permanent: true }),
        condition(CONDITION.poisoned, 2, { id: 'poison' }),
        condition(CONDITION.dazed, 2, { id: 'd1' }),
        condition(CONDITION.dazed, 1, { id: 'd2', source: 'sleep' }),
      ],
    })
    const after = r.nextRound(c, act({ kind: 'nextRound' }), conditions)
    assert.deepEqual(after.conditions.map(k => [k.id, k.level]), [['perm', 3], ['poison', 2], ['d1', 2]])
    assert.deepEqual(r.longRest(after, act({ kind: 'longRest', successful: true })).conditions.map(k => [k.id, k.level]), [['perm', 3], ['poison', 2], ['d1', 2]])
  })
  test('a condition missing from the catalogue is left alone; a custom non-permanent one is left alone', () => {
    const c = makeCharacter({
      conditions: [
        condition('player.conditions~gone', 2, { id: 'x' }),
        condition(null as unknown as string, 2, { id: 'y', conditionId: null, name: 'Hexed' }),
      ],
    })
    const after = r.nextRound(c, act({ kind: 'nextRound' }), conditions)
    assert.deepEqual(after.conditions.map(k => [k.id, k.level]), [['x', 2], ['y', 2]])
  })
})

describe('nextRound: rush', () => {
  test('rush becomes the new round number; unspent rush from the last round is gone', () => {
    const after = r.nextRound(withPlay(makeCharacter(), { round: 2, rushPoints: 1 }), act({ kind: 'nextRound' }), conditions)
    assert.equal(after.play.round, 3)
    assert.equal(after.play.rushPoints, 3)
  })
  test('an Unconscious character starts the round with 0 rush', () => {
    const c = withPlay(makeCharacter({ conditions: [condition(CONDITION.unconscious, null)] }), { round: 2, rushPoints: 2 })
    assert.equal(r.nextRound(c, act({ kind: 'nextRound' }), conditions).play.rushPoints, 0)
  })
  test('undo restores the previous rush and round', () => {
    const c = withPlay(makeCharacter(), { round: 2, rushPoints: 1 })
    const { character, inverse } = applyAction(c, act({ kind: 'nextRound' }), { conditions, talents: new Map() })
    assert.equal(character.play.rushPoints, 3)
    const undone = applyInverse(character, inverse).character
    assert.equal(undone.play.rushPoints, 1)
    assert.equal(undone.play.round, 2)
  })
})

describe('nextRound: Suffocating', () => {
  const suffocating = (over: Partial<Character> = {}) => makeCharacter({ conditions: [condition(CONDITION.suffocating, null, { id: 's' })], ...over })
  test('heart die d8 drops to d6; HP and conditions otherwise unchanged; the step is reported', () => {
    const c = suffocating()
    assert.deepEqual(r.suffocationStep(c), { kind: 'drop', from: 8, to: 6 })
    const after = r.nextRound(c, act({ kind: 'nextRound', suffocation: { kind: 'drop', from: 8, to: 6 } }), conditions)
    assert.equal(after.hp.heartDieCurrent, 6)
    assert.equal(after.hp.current, 40)
    assert.equal(after.play.staminaSpentRound, null)
  })
  test('at d4 the character falls unconscious (an ongoing row without a level); the die stays d4; rush is 0', () => {
    const c = suffocating({ hp: { baseMax: 40, current: 40, heartDieCurrent: 4 } })
    assert.deepEqual(r.suffocationStep(c), { kind: 'unconscious' })
    const after = r.nextRound(c, act({ kind: 'nextRound' }, 'N1'), conditions)
    assert.equal(after.hp.heartDieCurrent, 4)
    assert.deepEqual(after.conditions.find(k => k.conditionId === CONDITION.unconscious), { id: 'N1:0', conditionId: CONDITION.unconscious, name: null, level: null, permanent: false, source: 'manual', affects: [] })
    assert.equal(after.play.rushPoints, 0)
  })
  test('unconscious and suffocating: 10 damage, no wound; the die does not drop', () => {
    const c = suffocating({ conditions: [condition(CONDITION.suffocating, null), condition(CONDITION.unconscious, null)], hp: { baseMax: 40, current: 5, heartDieCurrent: 6 } })
    assert.deepEqual(r.suffocationStep(c), { kind: 'damage', amount: 10 })
    const after = r.nextRound(c, act({ kind: 'nextRound' }), conditions)
    assert.equal(after.hp.current, -5)
    assert.equal(after.hp.heartDieCurrent, 6)
    assert.deepEqual(after.wounds, [])
  })
  test('the damage can reach the death threshold (−max HP)', () => {
    const c = suffocating({ conditions: [condition(CONDITION.suffocating, null), condition(CONDITION.unconscious, null)], hp: { baseMax: 40, current: -32, heartDieCurrent: 4 } })
    const after = r.nextRound(c, act({ kind: 'nextRound' }), conditions)
    assert.equal(after.hp.current, -42)
    assert.ok(after.hp.current <= deathThreshold(after))
  })
  test('a suffocation step that differs from the sheet is refused', () => {
    refuses('bad_action', () => r.nextRound(suffocating(), act({ kind: 'nextRound', suffocation: { kind: 'unconscious' } }), conditions))
    refuses('bad_action', () => r.nextRound(makeCharacter(), act({ kind: 'nextRound', suffocation: { kind: 'drop', from: 8, to: 6 } }), conditions))
    assert.equal(r.nextRound(makeCharacter(), act({ kind: 'nextRound', suffocation: null }), conditions).play.round, 2)
  })
  test('no stamina spend while suffocating', () => {
    refuses('suffocating', () => r.heartDieSpend(suffocating(), act({ kind: 'heartDie:spend', effect: 'endure' })))
  })
})

describe('condition:set and condition:custom', () => {
  test('a new manual row takes <id>:0; level clamps to 1–5; permanent defaults to false', () => {
    const c = r.conditionSet(makeCharacter(), act({ kind: 'condition:set', conditionId: CONDITION.dazed, level: 9 }, 'C1'))
    assert.deepEqual(c.conditions, [{ id: 'C1:0', conditionId: CONDITION.dazed, name: null, level: 5, permanent: false, source: 'manual', affects: [] }])
  })
  test('acts on the manual row only; a sleep row of the same condition is untouched; level 0 removes just the manual row', () => {
    let c = makeCharacter({ conditions: [sleepRow(CONDITION.weakened, { id: 's' })] })
    c = r.conditionSet(c, act({ kind: 'condition:set', conditionId: CONDITION.weakened, level: 2 }, 'C2'))
    assert.deepEqual(c.conditions.map(k => [k.id, k.level, k.source]), [['s', 1, 'sleep'], ['C2:0', 2, 'manual']])
    c = r.conditionSet(c, act({ kind: 'condition:set', conditionId: CONDITION.weakened, level: 3, permanent: true }, 'C3'))
    assert.deepEqual(c.conditions.map(k => [k.id, k.level, k.permanent]), [['s', 1, false], ['C2:0', 3, true]])
    c = r.conditionSet(c, act({ kind: 'condition:set', conditionId: CONDITION.weakened, level: 0 }, 'C4'))
    assert.deepEqual(c.conditions.map(k => k.id), ['s'])
  })
  test('permanent omitted keeps the row as it was; level null makes an unleveled row; level 0 with no row is refused', () => {
    let c = r.conditionSet(makeCharacter(), act({ kind: 'condition:set', conditionId: CONDITION.crippled, level: null }, 'C5'))
    assert.equal(c.conditions[0]!.level, null)
    c = r.conditionSet(c, act({ kind: 'condition:set', conditionId: CONDITION.crippled, level: null, permanent: true }, 'C6'))
    c = r.conditionSet(c, act({ kind: 'condition:set', conditionId: CONDITION.crippled, level: null }, 'C7'))
    assert.equal(c.conditions[0]!.permanent, true)
    refuses('not_found', () => r.conditionSet(makeCharacter(), act({ kind: 'condition:set', conditionId: CONDITION.dazed, level: 0 })))
    refuses('invalid_amount', () => r.conditionSet(makeCharacter(), act({ kind: 'condition:set', conditionId: CONDITION.dazed, level: -1 })))
    refuses('invalid_amount', () => r.conditionSet(makeCharacter(), act({ kind: 'condition:set', conditionId: CONDITION.dazed, level: 1.5 })))
  })
  test('custom: create needs a name and takes <id>:0; edit by rowId; level 0 removes', () => {
    let c = r.conditionCustom(makeCharacter(), act({ kind: 'condition:custom', custom: { name: 'Cursed', affects: ['might', 'presence'] }, level: 3, permanent: true }, 'K1'))
    assert.deepEqual(c.conditions, [{ id: 'K1:0', conditionId: null, name: 'Cursed', level: 3, permanent: true, source: 'manual', affects: ['might', 'presence'] }])
    c = r.conditionCustom(c, act({ kind: 'condition:custom', rowId: 'K1:0', level: 9 }, 'K2'))
    assert.equal(c.conditions[0]!.level, 5)
    assert.equal(c.conditions[0]!.permanent, true)
    c = r.conditionCustom(c, act({ kind: 'condition:custom', rowId: 'K1:0', level: 0 }, 'K3'))
    assert.deepEqual(c.conditions, [])
    refuses('bad_action', () => r.conditionCustom(makeCharacter(), act({ kind: 'condition:custom', level: 1 })))
    refuses('bad_action', () => r.conditionCustom(makeCharacter(), act({ kind: 'condition:custom', custom: { name: '  ', affects: [] }, level: 1 })))
    refuses('invalid_amount', () => r.conditionCustom(makeCharacter(), act({ kind: 'condition:custom', custom: { name: 'X', affects: [] }, level: 0 })))
    refuses('not_found', () => r.conditionCustom(c, act({ kind: 'condition:custom', rowId: 'nope', level: 1 })))
    const withCatalogueRow = makeCharacter({ conditions: [condition(CONDITION.dazed, 1, { id: 'cat' })] })
    refuses('not_found', () => r.conditionCustom(withCatalogueRow, act({ kind: 'condition:custom', rowId: 'cat', level: 2 })))
  })
})

describe('criterion 12: ability:use, endFight, long rest reset', () => {
  test('minor with usesThisFight 1 and rush 3 → rush 1, uses 2', () => {
    const c = withPlay(makeCharacter({ talents: [talent({ usesThisFight: 1 })] }), { rushPoints: 3 })
    const after = r.abilityUse(c, act({ kind: 'ability:use', talentId: 't1' }))
    assert.equal(after.play.rushPoints, 1)
    assert.equal(after.talents[0]!.usesThisFight, 2)
  })
  test('minor with rush 1 at uses 1 → not_enough_rush; state unchanged', () => {
    const c = withPlay(makeCharacter({ talents: [talent({ usesThisFight: 1 })] }), { rushPoints: 1 })
    refuses('not_enough_rush', () => r.abilityUse(c, act({ kind: 'ability:use', talentId: 't1' })))
  })
  test('major, weekly and monthly set usedThisPeriod; a passive cannot be used; unknown id → not_found', () => {
    for (const frequency of ['major', 'weekly', 'monthly'] as const) {
      const c = makeCharacter({ talents: [talent({ frequency })] })
      const after = r.abilityUse(c, act({ kind: 'ability:use', talentId: 't1' }))
      assert.equal(after.talents[0]!.usedThisPeriod, true)
      assert.equal(after.talents[0]!.usesThisFight, 0)
    }
    refuses('bad_action', () => r.abilityUse(makeCharacter({ talents: [talent({ frequency: 'passive' })] }), act({ kind: 'ability:use', talentId: 't1' })))
    refuses('not_found', () => r.abilityUse(makeCharacter(), act({ kind: 'ability:use', talentId: 'zz' })))
  })
  test('ability:reset clears usedThisPeriod on a used major, weekly or monthly ability (design D13)', () => {
    for (const frequency of ['major', 'weekly', 'monthly'] as const) {
      const c = makeCharacter({ talents: [talent({ frequency, usedThisPeriod: true })] })
      assert.equal(r.abilityReset(c, act({ kind: 'ability:reset', talentId: 't1' })).talents[0]!.usedThisPeriod, false)
    }
    refuses('bad_action', () => r.abilityReset(makeCharacter({ talents: [talent({ frequency: 'weekly' })] }), act({ kind: 'ability:reset', talentId: 't1' })))
    refuses('bad_action', () => r.abilityReset(makeCharacter({ talents: [talent({ frequency: 'minor', usedThisPeriod: true })] }), act({ kind: 'ability:reset', talentId: 't1' })))
    refuses('bad_action', () => r.abilityReset(makeCharacter({ talents: [talent({ frequency: 'passive', usedThisPeriod: true })] }), act({ kind: 'ability:reset', talentId: 't1' })))
    refuses('not_found', () => r.abilityReset(makeCharacter(), act({ kind: 'ability:reset', talentId: 'zz' })))
  })
  test('endFight → rush 0, uses 0, round 1, staminaSpentRound null; usedThisPeriod is kept', () => {
    const c = withPlay(makeCharacter({ talents: [talent({ usesThisFight: 3, usedThisPeriod: true }), talent({ id: 't2', usesThisFight: 1 })] }), { rushPoints: 4, round: 6, staminaSpentRound: 6 })
    const after = r.endFight(c, act({ kind: 'endFight' }))
    assert.equal(after.play.rushPoints, 0)
    assert.equal(after.play.round, 1)
    assert.equal(after.play.staminaSpentRound, null)
    assert.deepEqual(after.talents.map(t => [t.usesThisFight, t.usedThisPeriod]), [[0, true], [0, false]])
  })
  test('rush:set and round:set take non-negative / positive integers', () => {
    assert.equal(r.rushSet(makeCharacter(), act({ kind: 'rush:set', value: 7 })).play.rushPoints, 7)
    assert.equal(r.roundSet(makeCharacter(), act({ kind: 'round:set', value: 4 })).play.round, 4)
    refuses('invalid_amount', () => r.rushSet(makeCharacter(), act({ kind: 'rush:set', value: -1 })))
    refuses('invalid_amount', () => r.rushSet(makeCharacter(), act({ kind: 'rush:set', value: 1.5 })))
    refuses('invalid_amount', () => r.roundSet(makeCharacter(), act({ kind: 'round:set', value: 0 })))
  })
})

describe('criterion 13: heart die', () => {
  test('endure at d8 round 2 → d6, staminaSpentRound 2; a second spend in round 2 is refused; next round → d4; at d4 refused', () => {
    let c = withPlay(makeCharacter(), { round: 2 })
    c = r.heartDieSpend(c, act({ kind: 'heartDie:spend', effect: 'endure' }))
    assert.equal(c.hp.heartDieCurrent, 6)
    assert.equal(c.play.staminaSpentRound, 2)
    refuses('stamina_spent', () => r.heartDieSpend(c, act({ kind: 'heartDie:spend', effect: 'focus' })))
    c = r.nextRound(c, act({ kind: 'nextRound' }), conditions)
    c = r.heartDieSpend(c, act({ kind: 'heartDie:spend', effect: 'surge' }))
    assert.equal(c.hp.heartDieCurrent, 4)
    c = r.nextRound(c, act({ kind: 'nextRound' }), conditions)
    refuses('heart_die_floor', () => r.heartDieSpend(c, act({ kind: 'heartDie:spend', effect: 'endure' })))
  })
  test('d12 → d10 → d8 and d20 → d12', () => {
    const at = (d: Character['hp']['heartDieCurrent']) => r.heartDieSpend(makeCharacter({ hp: { baseMax: 40, current: 40, heartDieCurrent: d } }), act({ kind: 'heartDie:spend', effect: 'endure' })).hp.heartDieCurrent
    assert.equal(at(12), 10)
    assert.equal(at(10), 8)
    assert.equal(at(20), 12)
  })
  test('heartDie:set 10 with max d8 → heart_die_over_max; within the max it sets; d20 needs 1000 awarded XP', () => {
    refuses('heart_die_over_max', () => r.heartDieSet(makeCharacter(), act({ kind: 'heartDie:set', value: 10 })))
    assert.equal(r.heartDieSet(makeCharacter(), act({ kind: 'heartDie:set', value: 6 })).hp.heartDieCurrent, 6)
    const veteran = makeCharacter({ xp: { awarded: 1000, purchases: [] } })
    assert.equal(r.heartDieSet(veteran, act({ kind: 'heartDie:set', value: 20 })).hp.heartDieCurrent, 20)
    refuses('invalid_amount', () => r.heartDieSet(veteran, act({ kind: 'heartDie:set', value: 7 as 6 })))
  })
  test('heartDie:set leaves staminaSpentRound alone', () => {
    const c = withPlay(makeCharacter(), { staminaSpentRound: 1 })
    assert.equal(r.heartDieSet(c, act({ kind: 'heartDie:set', value: 6 })).play.staminaSpentRound, 1)
  })
  test('shortRest → heart die back to the maximum for the awarded XP', () => {
    const low = makeCharacter({ hp: { baseMax: 40, current: 40, heartDieCurrent: 4 } })
    assert.equal(r.shortRest(low, act({ kind: 'shortRest' })).hp.heartDieCurrent, 8)
    const mid = makeCharacter({ hp: { baseMax: 40, current: 40, heartDieCurrent: 4 }, xp: { awarded: 500, purchases: [] } })
    const after = r.shortRest(mid, act({ kind: 'shortRest' }))
    assert.equal(after.hp.heartDieCurrent, maxHeartDie(mid))
    assert.equal(after.hp.heartDieCurrent, 12)
  })
})

describe('criterion 14: DP and sessions', () => {
  test('startSession: dp 1 → 3; dp 7 stays 7', () => {
    assert.equal(r.startSession(withPlay(makeCharacter(), { dp: 1 }), act({ kind: 'startSession' })).play.dp, 3)
    assert.equal(r.startSession(withPlay(makeCharacter(), { dp: 7 }), act({ kind: 'startSession' })).play.dp, 7)
  })
  test('dp:set 11 → clamped to 10; below 0 → clamped to 0; non-integer refused', () => {
    assert.equal(r.dpSet(makeCharacter(), act({ kind: 'dp:set', value: 11 })).play.dp, 10)
    assert.equal(r.dpSet(makeCharacter(), act({ kind: 'dp:set', value: -2 })).play.dp, 0)
    assert.equal(r.dpSet(makeCharacter(), act({ kind: 'dp:set', value: 6 })).play.dp, 6)
    refuses('invalid_amount', () => r.dpSet(makeCharacter(), act({ kind: 'dp:set', value: 2.5 })))
  })
})

describe('aspect:invoke and aspect:hinder', () => {
  const aspect = (id: string, rank: number, over: Partial<Aspect> = {}): Aspect => ({ id, text: `Aspect ${id}`, rank, source: 'created', honor: false, ...over })
  const frail = aspect('frail', 3, { text: 'Frail', source: 'age' })
  const sheet = (dp: number, play: Partial<Character['play']> = {}) =>
    withPlay(makeCharacter({ aspects: [aspect('one', 1), aspect('three', 3), frail] }), { dp, ...play })

  test('bonus: spends 1…rank DP', () => {
    for (const dp of [1, 2, 3]) assert.equal(r.aspectInvoke(sheet(5), act({ kind: 'aspect:invoke', aspectId: 'three', dp })).play.dp, 5 - dp)
    assert.equal(r.aspectInvoke(sheet(1), act({ kind: 'aspect:invoke', aspectId: 'one', dp: 1 })).play.dp, 0)
  })
  test('bonus over the rank, below 1 or fractional is refused', () => {
    refuses('invalid_amount', () => r.aspectInvoke(sheet(5), act({ kind: 'aspect:invoke', aspectId: 'three', dp: 4 })))
    refuses('invalid_amount', () => r.aspectInvoke(sheet(5), act({ kind: 'aspect:invoke', aspectId: 'one', dp: 2 })))
    refuses('invalid_amount', () => r.aspectInvoke(sheet(5), act({ kind: 'aspect:invoke', aspectId: 'three', dp: 0 })))
    refuses('invalid_amount', () => r.aspectInvoke(sheet(5), act({ kind: 'aspect:invoke', aspectId: 'three', dp: 1.5 })))
  })
  test('bonus with too few DP is refused', () => {
    refuses('not_enough_dp', () => r.aspectInvoke(sheet(2), act({ kind: 'aspect:invoke', aspectId: 'three', dp: 3 })))
    refuses('not_enough_dp', () => r.aspectInvoke(sheet(0), act({ kind: 'aspect:invoke', aspectId: 'one', dp: 1 })))
  })
  test('Frail is never invoked for a bonus; an unknown aspect is not_found', () => {
    refuses('bad_action', () => r.aspectInvoke(sheet(5), act({ kind: 'aspect:invoke', aspectId: 'frail', dp: 1 })))
    refuses('not_found', () => r.aspectInvoke(sheet(5), act({ kind: 'aspect:invoke', aspectId: 'nope', dp: 1 })))
    refuses('not_found', () => r.aspectHinder(sheet(5), act({ kind: 'aspect:hinder', aspectId: 'nope' })))
  })
  test('hinder gains the rank; Frail hinders like any aspect', () => {
    assert.equal(r.aspectHinder(sheet(3), act({ kind: 'aspect:hinder', aspectId: 'three' })).play.dp, 6)
    assert.equal(r.aspectHinder(sheet(3), act({ kind: 'aspect:hinder', aspectId: 'one' })).play.dp, 4)
    assert.equal(r.aspectHinder(sheet(3), act({ kind: 'aspect:hinder', aspectId: 'frail' })).play.dp, 6)
  })
  test('hinder with Young and Foolish gains rank + 1', () => {
    assert.equal(r.aspectHinder(sheet(3, { youngAndFoolish: true }), act({ kind: 'aspect:hinder', aspectId: 'three' })).play.dp, 7)
    assert.equal(r.aspectHinder(sheet(3, { youngAndFoolish: true }), act({ kind: 'aspect:hinder', aspectId: 'one' })).play.dp, 5)
  })
  test('hinder caps DP at 10', () => {
    assert.equal(r.aspectHinder(sheet(9), act({ kind: 'aspect:hinder', aspectId: 'three' })).play.dp, 10)
    assert.equal(r.aspectHinder(sheet(10, { youngAndFoolish: true }), act({ kind: 'aspect:hinder', aspectId: 'one' })).play.dp, 10)
  })
  test('both are undone by their stored inverse', () => {
    const catalogue = { conditions, talents: new Map() }
    const start = sheet(4, { youngAndFoolish: true })
    const used = applyAction(start, act({ kind: 'aspect:invoke', aspectId: 'three', dp: 2 }) as ClientAction, catalogue)
    assert.equal(used.character.play.dp, 2)
    assert.deepEqual(applyInverse(used.character, used.inverse).character, start)
    const hindered = applyAction(start, act({ kind: 'aspect:hinder', aspectId: 'three' }) as ClientAction, catalogue)
    assert.equal(hindered.character.play.dp, 8)
    assert.deepEqual(applyInverse(hindered.character, hindered.inverse).character, start)
  })
  test('Frail cannot be renamed, and no aspect can be renamed into Frail; its honor tick still edits', () => {
    const catalogue = { conditions, talents: new Map() }
    const start = makeCharacter({ aspects: [aspect('one', 1), aspect('wisdom', 1, { text: 'Wisdom of Years', source: 'age' }), frail] })
    const edit = (aspect: { id: string; text?: string; honor?: boolean }) => () => applyAction(start, act({ kind: 'aspect:edit', aspect }) as ClientAction, catalogue)
    refuses('bad_action', edit({ id: 'frail', text: 'Sturdy' }))
    refuses('bad_action', edit({ id: 'wisdom', text: 'Frail' }))
    assert.equal(edit({ id: 'frail', honor: true })().character.aspects[2]!.honor, true)
    assert.equal(edit({ id: 'one', text: 'Bold' })().character.aspects[0]!.text, 'Bold')
  })
  test('a stored state or stored inverse with the old dpPerComplication field reads as youngAndFoolish', () => {
    const { youngAndFoolish: _, ...rest } = makeCharacter().play
    const old = (n: number) => ({ ...makeCharacter(), play: { ...rest, dpPerComplication: n } })
    const upgraded = upgradeCharacter(JSON.parse(JSON.stringify(old(2)))) as Character
    assert.equal(upgraded.play.youngAndFoolish, true)
    assert.equal('dpPerComplication' in upgraded.play, false)
    assert.equal((upgradeCharacter(old(1)) as Character).play.youngAndFoolish, false)
    const restored = applyInverse(makeCharacter(), { kind: 'restore', slices: { play: old(2).play as never } }).character
    assert.deepEqual(restored.play, { ...rest, youngAndFoolish: true })
  })
})

describe('purity', () => {
  const deepFreeze = <T>(o: T): T => {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o)
      for (const v of Object.values(o)) deepFreeze(v)
    }
    return o
  }
  test('no reducer mutates its input, and each returns the same result when called twice', () => {
    const c = deepFreeze(withPlay(makeCharacter({
      wounds: [{ id: 'w', rank: 3, description: '', treated: false, takenAt: AT }],
      conditions: [condition(CONDITION.weakened, 2, { id: 'k' })],
      talents: [talent(), talent({ id: 'maj', frequency: 'major' }), talent({ id: 'wk', frequency: 'weekly', usedThisPeriod: true })],
      hp: { baseMax: 40, current: 20, heartDieCurrent: 8 },
    }), { rushPoints: 5, dp: 2 }))
    const calls: Array<() => Character> = [
      () => r.damage(c, act({ kind: 'damage', amount: 11 })),
      () => r.heal(c, act({ kind: 'heal', amount: 4 })),
      () => r.setHp(c, act({ kind: 'setHp', value: 9 })),
      () => r.woundAdd(c, act({ kind: 'wound:add', wound: { rank: 2 } })),
      () => r.woundEdit(c, act({ kind: 'wound:edit', wound: { id: 'w', rank: 2 } })),
      () => r.woundRemove(c, act({ kind: 'wound:remove', woundId: 'w' })),
      () => r.woundTreat(c, act({ kind: 'wound:treat', woundId: 'w', medicineRoll: 1 })),
      () => r.conditionSet(c, act({ kind: 'condition:set', conditionId: CONDITION.weakened, level: 4 })),
      () => r.conditionCustom(c, act({ kind: 'condition:custom', custom: { name: 'X', affects: [] }, level: 1 })),
      () => r.abilityUse(c, act({ kind: 'ability:use', talentId: 't1' })),
      () => r.abilityUse(c, act({ kind: 'ability:use', talentId: 'maj' })),
      () => r.abilityReset(c, act({ kind: 'ability:reset', talentId: 'wk' })),
      () => r.rushSet(c, act({ kind: 'rush:set', value: 1 })),
      () => r.dpSet(c, act({ kind: 'dp:set', value: 9 })),
      () => r.roundSet(c, act({ kind: 'round:set', value: 3 })),
      () => r.heartDieSpend(c, act({ kind: 'heartDie:spend', effect: 'focus' })),
      () => r.heartDieSet(c, act({ kind: 'heartDie:set', value: 6 })),
      () => r.nextRound(c, act({ kind: 'nextRound' }), conditions),
      () => r.endFight(c, act({ kind: 'endFight' })),
      () => r.shortRest(c, act({ kind: 'shortRest' })),
      () => r.longRest(c, act({ kind: 'longRest', successful: true })),
      () => r.longRest(c, act({ kind: 'longRest', successful: false, rolled: ['dazed'] })),
      () => r.startSession(c, act({ kind: 'startSession' })),
    ]
    for (const call of calls) {
      const first = call()
      assert.notEqual(first, c)
      assert.deepEqual(call(), first)
    }
  })
})
