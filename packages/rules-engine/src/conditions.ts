// Ruling 10: condition ids are the compiler's ids (`player.conditions~<anchor>`). The engine names only these.
import type { Character } from './types'

const id = (anchor: string) => `player.conditions~${anchor}`

export const CONDITION = {
  dazed: id('dazed'),
  weakened: id('weakened'),
  offBalanced: id('off-balanced'),
  burning: id('burning'),
  restrained: id('restrained'),
  slowed: id('slowed'),
  crippled: id('crippled'),
  poisoned: id('poisoned'),
  unconscious: id('unconscious'),
  suffocating: id('suffocating'),
  grappled: id('grappled'),
  entangled: id('entangled'),
  aggravated: id('aggravated'),
  frightened: id('frightened'),
} as const

/** The three conditions a failed long rest can roll (`longRest.rolled`), as catalogue ids. */
export const SLEEP_ROLL_CONDITION = {
  weakened: CONDITION.weakened,
  'off-balanced': CONDITION.offBalanced,
  dazed: CONDITION.dazed,
} as const

/** True when any condition row with this catalogue id exists (rows of one condition may be split by source). */
export function hasCondition(c: Character, conditionId: string): boolean {
  return c.conditions.some(k => k.conditionId === conditionId)
}
