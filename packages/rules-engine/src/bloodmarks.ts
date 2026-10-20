import type { BloodmarkKind, Character } from './types'
import { RuleError } from './types'

/** Starting Bloodmarks table, Building_Your_Character.md. */
export function startingXp(level: number): number {
  if (!Number.isInteger(level) || level < 0) throw new RuleError('invalid_amount')
  return [5, 15, 30, 50, 80][level] ?? 120 + (level - 5) * 40
}

/** Cumulative Bloodmark Progression, minus the abilities already selected. */
export function bloodmarkPicksOwed(c: Character): Record<BloodmarkKind, number> {
  const level = c.bloodmarks.level
  if (!Number.isInteger(level) || level < 0) throw new RuleError('invalid_amount')
  const owed: Record<BloodmarkKind, number> = {
    specialization: Number(level >= 1) + Number(level >= 2),
    signature: Number(level >= 2) + 2 * Number(level >= 3),
    mastery: Number(level >= 4),
    paragon: Math.max(0, level - 4),
  }
  for (const ability of c.bloodmarks.abilities) owed[ability.kind]--
  return owed
}
