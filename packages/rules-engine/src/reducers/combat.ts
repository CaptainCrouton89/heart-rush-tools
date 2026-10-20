// Pure combat, condition and rest reducers. The action supplies every new row's id and timestamp.
import type { ConditionCatalogue } from '../catalogue'
import { SLEEP_ROLL_CONDITION } from '../conditions'
import { effectiveMaxHp, maxHeartDie, minorUseCost } from '../derived'
import { RuleError, type Action, type Character, type Condition, type HeartDie, type Wound } from '../types'

type Of<K extends Action['kind']> = Extract<Action, { kind: K }> | (Extract<Action, { kind: 'rush:set' | 'dp:set' | 'round:set' }> & { kind: K })

function integer(value: number, min: number): void {
  if (!Number.isSafeInteger(value) || value < min) throw new RuleError('invalid_amount')
}
function finiteInteger(value: number): void {
  if (!Number.isSafeInteger(value)) throw new RuleError('invalid_amount')
}
function level(value: number | null): number | null {
  if (value === null) return null
  integer(value, 0)
  return Math.min(5, value)
}
function updateHp(c: Character, current: number): Character {
  return { ...c, hp: { ...c.hp, current } }
}
function updatePlay(c: Character, changes: Partial<Character['play']>): Character {
  return { ...c, play: { ...c.play, ...changes } }
}
function woundIndex(c: Character, id: string): number {
  const index = c.wounds.findIndex(w => w.id === id)
  if (index === -1) throw new RuleError('not_found')
  return index
}

export function damage(c: Character, a: Of<'damage'>): Character {
  integer(a.amount, 1)
  const wound: Wound = { id: `${a.id}:0`, rank: a.amount, description: a.woundDescription ?? '', treated: false, takenAt: a.at }
  return { ...c, hp: { ...c.hp, current: c.hp.current - a.amount }, wounds: a.amount >= 10 ? [...c.wounds, wound] : c.wounds }
}
export function heal(c: Character, a: Of<'heal'>): Character {
  integer(a.amount, 1)
  return updateHp(c, Math.max(c.hp.current, Math.min(effectiveMaxHp(c), c.hp.current + a.amount)))
}
export function setHp(c: Character, a: Of<'setHp'>): Character {
  finiteInteger(a.value)
  if (a.value > effectiveMaxHp(c)) throw new RuleError('invalid_amount')
  return updateHp(c, a.value)
}
export function woundAdd(c: Character, a: Of<'wound:add'>): Character {
  integer(a.wound.rank, 1)
  return { ...c, wounds: [...c.wounds, { id: `${a.id}:0`, rank: a.wound.rank, description: a.wound.description ?? '', treated: false, takenAt: a.at }] }
}
export function woundEdit(c: Character, a: Of<'wound:edit'>): Character {
  const index = woundIndex(c, a.wound.id)
  if (a.wound.rank !== undefined) integer(a.wound.rank, 1)
  return { ...c, wounds: c.wounds.map((w, i) => i === index ? { ...w, ...a.wound } : w) }
}
export function woundRemove(c: Character, a: Of<'wound:remove'>): Character {
  const index = woundIndex(c, a.woundId)
  return { ...c, wounds: c.wounds.filter((_, i) => i !== index) }
}
export function woundTreat(c: Character, a: Of<'wound:treat'>): Character {
  const index = woundIndex(c, a.woundId)
  integer(a.medicineRoll, 0)
  const w = c.wounds[index]!
  if (w.treated) throw new RuleError('bad_action', 'Wound already treated')
  if (a.medicineRoll >= w.rank) return { ...c, wounds: c.wounds.filter((_, i) => i !== index) }
  return { ...c, wounds: c.wounds.map((row, i) => i === index ? { ...row, rank: row.rank - a.medicineRoll, treated: true } : row) }
}

export function conditionSet(c: Character, a: Of<'condition:set'>): Character {
  if (!a.conditionId) throw new RuleError('bad_action')
  const next = level(a.level)
  const index = c.conditions.findIndex(k => k.conditionId === a.conditionId && k.source === 'manual')
  if (next === 0) {
    if (index === -1) throw new RuleError('not_found')
    return { ...c, conditions: c.conditions.filter((_, i) => i !== index) }
  }
  const otherLevels = c.conditions.reduce((sum, k, i) => sum + (i !== index && k.conditionId === a.conditionId ? k.level ?? 1 : 0), 0)
  const capped = next === null ? null : Math.max(0, Math.min(next, 5 - otherLevels))
  if (index !== -1) return { ...c, conditions: c.conditions.map((k, i) => i === index ? { ...k, level: capped, permanent: a.permanent ?? k.permanent } : k) }
  if (capped === 0) return { ...c }
  return { ...c, conditions: [...c.conditions, { id: `${a.id}:0`, conditionId: a.conditionId, name: null, level: capped, permanent: a.permanent ?? false, source: 'manual', affects: [] }] }
}
export function conditionCustom(c: Character, a: Of<'condition:custom'>): Character {
  const next = level(a.level)
  if (a.rowId !== undefined) {
    const index = c.conditions.findIndex(k => k.id === a.rowId && k.conditionId === null)
    if (index === -1) throw new RuleError('not_found')
    if (next === 0) return { ...c, conditions: c.conditions.filter((_, i) => i !== index) }
    if (a.custom && !a.custom.name.trim()) throw new RuleError('bad_action')
    return { ...c, conditions: c.conditions.map((k, i) => i === index ? {
      ...k, level: next, permanent: a.permanent ?? k.permanent,
      name: a.custom?.name ?? k.name, affects: a.custom?.affects ?? k.affects,
    } : k) }
  }
  if (!a.custom?.name.trim()) throw new RuleError('bad_action')
  if (next === 0) throw new RuleError('invalid_amount')
  const row: Condition = { id: `${a.id}:0`, conditionId: null, name: a.custom.name, affects: [...a.custom.affects], level: next, permanent: a.permanent ?? false, source: 'manual' }
  return { ...c, conditions: [...c.conditions, row] }
}

export function abilityUse(c: Character, a: Of<'ability:use'>): Character {
  const t = c.talents.find(t => t.id === a.talentId)
  if (!t) throw new RuleError('not_found')
  if (t.frequency === 'passive') throw new RuleError('bad_action', 'Passive ability cannot be used')
  if (t.frequency === 'minor') {
    const cost = minorUseCost(t)
    if (c.play.rushPoints < cost) throw new RuleError('not_enough_rush')
    return { ...c, play: { ...c.play, rushPoints: c.play.rushPoints - cost }, talents: c.talents.map(row => row.id === t.id ? { ...row, usesThisFight: row.usesThisFight + 1 } : row) }
  }
  if (t.usedThisPeriod) throw new RuleError('bad_action', 'Ability already used this period')
  return { ...c, talents: c.talents.map(row => row.id === t.id ? { ...row, usedThisPeriod: true } : row) }
}
export function abilityReset(c: Character, a: Of<'ability:reset'>): Character {
  const t = c.talents.find(t => t.id === a.talentId)
  if (!t) throw new RuleError('not_found')
  if (t.frequency === 'minor' || t.frequency === 'passive') throw new RuleError('bad_action', 'Only a major, weekly or monthly ability is reset')
  if (!t.usedThisPeriod) throw new RuleError('bad_action', 'Ability is not used')
  return { ...c, talents: c.talents.map(row => row.id === t.id ? { ...row, usedThisPeriod: false } : row) }
}
export function rushSet(c: Character, a: Of<'rush:set'>): Character {
  integer(a.value, 0)
  return updatePlay(c, { rushPoints: a.value })
}
export function dpSet(c: Character, a: Of<'dp:set'>): Character {
  finiteInteger(a.value)
  return updatePlay(c, { dp: Math.max(0, Math.min(10, a.value)) })
}
export function roundSet(c: Character, a: Of<'round:set'>): Character {
  integer(a.value, 1)
  return updatePlay(c, { round: a.value })
}
const HEART_STEPS: readonly HeartDie[] = [4, 6, 8, 10, 12, 20]
export function heartDieSpend(c: Character, a: Of<'heartDie:spend'>): Character {
  if (!['endure', 'focus', 'surge'].includes(a.effect)) throw new RuleError('bad_action')
  if (c.play.staminaSpentRound === c.play.round) throw new RuleError('stamina_spent')
  const index = HEART_STEPS.indexOf(c.hp.heartDieCurrent)
  if (index <= 0) throw new RuleError('heart_die_floor')
  return { ...c, hp: { ...c.hp, heartDieCurrent: HEART_STEPS[index - 1]! }, play: { ...c.play, staminaSpentRound: c.play.round } }
}
export function heartDieSet(c: Character, a: Of<'heartDie:set'>): Character {
  if (!HEART_STEPS.includes(a.value)) throw new RuleError('invalid_amount')
  if (a.value > maxHeartDie(c)) throw new RuleError('heart_die_over_max')
  return { ...c, hp: { ...c.hp, heartDieCurrent: a.value } }
}
export function nextRound(c: Character, _a: Of<'nextRound'>, catalogue: ConditionCatalogue): Character {
  const decremented = new Set<string>()
  // Stacked rows contribute one condition total. Remove just one fading level, preferring
  // sleep rows so a later successful rest can still remove only sleep-sourced levels.
  const ordered = [...c.conditions].sort((left, right) => Number(right.source === 'sleep') - Number(left.source === 'sleep'))
  const faded = new Map<string, Condition>()
  for (const k of ordered) {
    if (k.permanent || !k.conditionId || !catalogue.get(k.conditionId)?.fading || k.level === null || decremented.has(k.conditionId)) continue
    decremented.add(k.conditionId)
    if (k.level > 1) faded.set(k.id, { ...k, level: k.level - 1 })
    else faded.set(k.id, k) // deleted below while preserving the input order of other rows
  }
  const conditions = c.conditions.flatMap(k => {
    const next = faded.get(k.id)
    if (!next) return [k]
    return next === k ? [] : [next]
  })
  return { ...c, conditions, play: { ...c.play, round: c.play.round + 1 } }
}
export function endFight(c: Character, _a: Of<'endFight'>): Character {
  return { ...c, play: { ...c.play, rushPoints: 0, round: 1, staminaSpentRound: null }, talents: c.talents.map(t => ({ ...t, usesThisFight: 0 })) }
}
export function shortRest(c: Character, _a: Of<'shortRest'>): Character {
  return { ...c, hp: { ...c.hp, heartDieCurrent: maxHeartDie(c) } }
}
export function longRest(c: Character, a: Of<'longRest'>): Character {
  if (a.successful) {
    const wounds = c.wounds.filter(w => w.rank > 1).map(w => ({ ...w, rank: w.rank - 1 }))
    const rested = { ...c, wounds }
    return {
      ...rested,
      hp: { ...c.hp, current: effectiveMaxHp(rested), heartDieCurrent: maxHeartDie(c) },
      talents: c.talents.map(t => t.frequency === 'major' ? { ...t, usedThisPeriod: false } : t),
      conditions: c.conditions.filter(k => k.source !== 'sleep'),
      play: { ...c.play, failedRestStreak: 0 },
    }
  }
  const streak = c.play.failedRestStreak + 1
  if (a.rolled.length !== (streak === 2 ? 2 : 1)) throw new RuleError('wrong_rolled_count')
  const added: Condition[] = []
  a.rolled.forEach((name, i) => {
    if (!Object.hasOwn(SLEEP_ROLL_CONDITION, name)) throw new RuleError('bad_action')
    const conditionId = SLEEP_ROLL_CONDITION[name]
    const total = [...c.conditions, ...added].reduce((sum, k) => sum + (k.conditionId === conditionId ? k.level ?? 1 : 0), 0)
    if (total < 5) added.push({ id: `${a.id}:${i}`, conditionId, name: null, level: 1, permanent: false, source: 'sleep', affects: [] })
  })
  const missing = Math.max(0, effectiveMaxHp(c) - c.hp.current)
  return {
    ...c,
    hp: { ...c.hp, current: c.hp.current + Math.floor(missing / 2), heartDieCurrent: maxHeartDie(c) },
    conditions: [...c.conditions, ...added],
    play: { ...c.play, failedRestStreak: streak },
  }
}
export function startSession(c: Character, _a: Of<'startSession'>): Character {
  return updatePlay(c, { dp: Math.max(3, c.play.dp) })
}
