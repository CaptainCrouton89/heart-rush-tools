import type { ConditionCatalogue } from './catalogue'
import { defenseBonus, disadvantage, weaponDice } from './derived'
import { RuleError, type AbilityId, type Character } from './types'

export type RollType = 'check' | 'save' | 'attack' | 'defense'
export type RollDie = { sides: number; role: 'heart' | 'ability' | 'weapon' }
export type RollSpec = {
  type: RollType
  ability: AbilityId
  dice: RollDie[]
  flat: number
  complicationRule: boolean
  defaultNet: number
}
/** `rerolled`: the die was rerolled and this is its new value (the old value was a 1). `focused`: Focus set it to its maximum from this value. */
export type RolledDie = RollDie & { value: number; dropped: boolean; rerolled?: number; focused?: number }
export type RollResult = {
  type: RollType
  ability: AbilityId
  dice: RolledDie[]
  flat: number
  modifier: number
  net: number
  total: number
  complication: 'none' | 'pending' | 'failed' | 'rerolled'
  automaticFailure: boolean
}
export type RandomDie = (sides: number) => number

function badRoll(): never { throw new RuleError('bad_roll') }

/** The dice and modifiers to roll, derived from the current character rather than saved on it. */
export function rollSpec(c: Character, input: { type: RollType; ability: AbilityId }, catalogue: ConditionCatalogue): RollSpec {
  const { type, ability } = input
  if (!['might', 'agility', 'cunning', 'presence'].includes(ability)) badRoll()
  if (!['check', 'save', 'attack', 'defense'].includes(type)) badRoll()
  if ((type === 'attack' || type === 'defense') && ability === 'presence') badRoll()
  const dice: RollDie[] = [
    { sides: c.hp.heartDieCurrent, role: 'heart' },
    { sides: c.abilities[ability].current, role: 'ability' },
  ]
  let flat = type === 'defense' ? defenseBonus(c) : 0
  if (type === 'attack') {
    const notation = weaponDice(c, ability as 'might' | 'agility' | 'cunning')
    if (notation) {
      const match = /^(\d+)d(\d+)(?:\+(-?\d+))?$/.exec(notation)
      if (!match) badRoll()
      const count = Number(match[1]), sides = Number(match[2])
      for (let i = 0; i < count; i++) dice.push({ sides, role: 'weapon' })
      flat += Number(match[3] ?? 0)
    }
  }
  return { type, ability, dice, flat, complicationRule: type === 'check', defaultNet: -disadvantage(c, ability, catalogue) }
}

function throwIfInvalidInteger(value: number): void {
  if (!Number.isSafeInteger(value)) badRoll()
}

function draw(sides: number, rand: RandomDie): number {
  const value = rand(sides)
  if (!Number.isInteger(value) || value < 1 || value > sides) badRoll()
  return value
}

/** A positive net is advantage, a negative net is disadvantage. Only kept dice can complicate a check. */
export function roll(spec: RollSpec, options: { modifier: number; net: number }, rand: RandomDie): RollResult {
  throwIfInvalidInteger(options.modifier)
  throwIfInvalidInteger(options.net)
  if (!spec.dice.length || spec.dice.some(d => !Number.isSafeInteger(d.sides) || d.sides < 2)) badRoll()
  const { net, modifier } = options
  const extra = net > 0 ? spec.dice.reduce((a, b) => a.sides <= b.sides ? a : b)
    : spec.dice.reduce((a, b) => a.sides >= b.sides ? a : b)
  const dice: RolledDie[] = [...spec.dice, ...Array.from({ length: Math.abs(net) }, () => extra)].map(d => ({ ...d, value: draw(d.sides, rand), dropped: false }))
  if (net) {
    const indices = dice.map((_, i) => i).sort((a, b) => net > 0
      ? dice[a]!.value - dice[b]!.value || a - b
      : dice[b]!.value - dice[a]!.value || a - b)
    for (const i of indices.slice(0, Math.abs(net))) dice[i]!.dropped = true
  }
  const ones = spec.complicationRule ? dice.filter(d => !d.dropped && d.value === 1).length : 0
  return {
    type: spec.type, ability: spec.ability, dice, flat: spec.flat, modifier, net,
    total: dice.filter(d => !d.dropped).reduce((sum, d) => sum + d.value, spec.flat + modifier),
    complication: ones >= 2 ? 'failed' : ones === 1 ? 'pending' : 'none',
    automaticFailure: ones >= 2,
  }
}

/** Resolves one pending in-memory choice, without changing the original result or triggering another choice. */
export function rerollComplication(result: RollResult, rand: RandomDie): RollResult {
  if (result.complication !== 'pending' || result.automaticFailure) badRoll()
  const index = result.dice.findIndex(d => !d.dropped && d.value === 1 && d.rerolled === undefined)
  if (index < 0 || result.dice.filter(d => !d.dropped && d.value === 1).length !== 1) badRoll()
  const dice = result.dice.map(d => ({ ...d }))
  const die = dice[index]!
  const rerolled = draw(die.sides, rand)
  die.rerolled = rerolled
  die.value = rerolled
  return { ...result, dice, total: result.total - 1 + rerolled, complication: 'rerolled' }
}

/**
 * Focus (`Combat.md` Spending Stamina): one kept die of the roll becomes its maximum and the total goes up by the difference.
 * Once per roll. The heart die spend that pays for it is `heartDie:spend` with effect `focus`. A pending complication is
 * chosen first (`Dice_Mechanics_&_Resolution.md`: a 1 on a skill check means you must choose), so Focus waits for it.
 */
export function focusDie(result: RollResult, index: number): RollResult {
  const target = result.dice[index]
  if (!Number.isSafeInteger(index) || !target || target.dropped) badRoll()
  if (result.complication === 'pending' && !result.automaticFailure) badRoll()
  if (result.dice.some(d => d.focused !== undefined)) badRoll()
  const dice = result.dice.map((d, i) => i === index ? { ...d, value: d.sides, focused: d.value } : { ...d })
  return { ...result, dice, total: result.total - target.value + target.sides }
}

/** The kept dice showing 1 that Wisdom of Experience may reroll: the indices, empty when there is nothing to reroll. */
export function onesToReroll(result: Pick<RollResult, 'type' | 'dice'>): number[] {
  if (result.type !== 'check') return []
  return result.dice.flatMap((d, i) => !d.dropped && d.value === 1 && d.rerolled === undefined ? [i] : [])
}

/**
 * Wisdom of Experience (`Building_Your_Character.md` Elderly): on a skill check with the chosen profession, every kept 1 is
 * rerolled. The rerolls trigger no complication and a 1 on a reroll stands, so the complication becomes `none`.
 */
export function rerollOnes(result: RollResult, rand: RandomDie): RollResult {
  const indices = onesToReroll(result)
  // A chosen Fail or a complication reroll already settled the 1; two kept 1s (automatic failure) have not been settled.
  if (!indices.length || (result.complication === 'failed' && !result.automaticFailure) || result.complication === 'rerolled') badRoll()
  const dice = result.dice.map(d => ({ ...d }))
  let total = result.total
  for (const i of indices) {
    const die = dice[i]!
    const value = draw(die.sides, rand)
    die.rerolled = value
    die.value = value
    total += value - 1
  }
  return { ...result, dice, total, complication: 'none', automaticFailure: false }
}

/** Plain result line; the UI renders dropped dice with a strike-through using `dice[].dropped`. */
export function formatRoll(result: RollResult): string {
  const parts = result.dice.filter(d => !d.dropped).map(d => `${d.role === 'heart' ? 'heart ' : ''}d${d.sides} ${d.value}`)
  if (result.flat) parts.push(String(result.flat))
  if (result.modifier) parts.push(String(result.modifier))
  const label = `${result.ability[0]!.toUpperCase()}${result.ability.slice(1)} ${result.type}`
  const net = result.net ? ` · ${result.net > 0 ? 'A' : 'D'}${Math.abs(result.net)} dropped ${result.dice.filter(d => d.dropped).map(d => `d${d.sides} ${d.value}`).join(', ')}` : ''
  return `${label}: ${parts.join(' + ').replace(/\+ -/g, '- ')} = ${result.total}${net}`
}
