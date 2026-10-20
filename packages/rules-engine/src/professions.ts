// Profession progress (spec §5): the Advancement Requirements table in Building_Your_Character.md,
// derived progress for one profession, and the reducers for the four progress action kinds.
// Pure (INV-PURE). Add/edit/remove of professions belong to reducers/collections.ts.
import { maxHeartDie } from './derived'
import { RuleError } from './types'
import type { Action, Character, Profession } from './types'

/** Row n is the requirement to go from rank n to rank n+1. */
const ADVANCEMENT: ReadonlyArray<{ challenges: number; mission: boolean; weeks: number }> = [
  { challenges: 2, mission: false, weeks: 1 },
  { challenges: 3, mission: false, weeks: 4 },
  { challenges: 4, mission: true, weeks: 9 },
  { challenges: 5, mission: true, weeks: 16 },
  { challenges: 6, mission: true, weeks: 25 },
  { challenges: 7, mission: true, weeks: 36 },
  { challenges: 8, mission: true, weeks: 49 },
]
/** Rank names by rank; rank 7 is still Legendary (the rulebook's "Rank 6+ … (Legendary)"). */
const RANK_NAMES = ['', 'Novice', 'Apprentice', 'Journeyman', 'Expert', 'Master', 'Legendary', 'Legendary'] as const
const HIGHEST_RANK = ADVANCEMENT.length

export type ProfessionProgress = {
  rank: number
  /** '' at rank 0. */
  rankName: string
  /** Null at rank 6 and 7: the table gives no name beyond Legendary. */
  nextRankName: string | null
  challengesNeeded: number
  missionRequired: boolean
  practiceNeeded: number
  challengeCn: number
  canAdvance: boolean
  highest: boolean
}

function find(c: Character, professionId: string): Profession {
  const p = c.professions.find((x) => x.id === professionId)
  if (!p) throw new RuleError('not_found', `No profession ${professionId}`)
  return p
}

export function professionProgress(c: Character, professionId: string): ProfessionProgress {
  const p = find(c, professionId)
  const base = {
    rank: p.rank,
    rankName: RANK_NAMES[Math.min(p.rank, HIGHEST_RANK)]!,
    challengeCn: maxHeartDie(c) + p.rank,
  }
  const row = ADVANCEMENT[p.rank]
  if (!row) {
    return { ...base, nextRankName: null, challengesNeeded: 0, missionRequired: false, practiceNeeded: 0, canAdvance: false, highest: true }
  }
  const challengesNeeded = Math.max(1, row.challenges + c.play.professionChallengeDelta)
  const practiceNeeded = Math.max(0, row.weeks - Math.max(0, p.challenges - challengesNeeded))
  const nextName = RANK_NAMES[p.rank + 1]!
  return {
    ...base,
    nextRankName: p.rank < 6 ? nextName : null,
    challengesNeeded,
    missionRequired: row.mission,
    practiceNeeded,
    canAdvance: p.challenges >= challengesNeeded && (!row.mission || p.missions >= 1) && p.practiceWeeks >= practiceNeeded,
    highest: false,
  }
}

const PROGRESS_KINDS = ['profession:challenge', 'profession:practice', 'profession:mission', 'profession:advance'] as const
export type ProfessionProgressAction = Extract<Action, { kind: (typeof PROGRESS_KINDS)[number] }>

export function isProfessionProgressAction(a: Action): a is ProfessionProgressAction {
  return (PROGRESS_KINDS as readonly string[]).includes(a.kind)
}

export function reduceProfessionProgress(c: Character, a: ProfessionProgressAction): Character {
  const p = find(c, a.professionId)
  let next: Profession
  switch (a.kind) {
    case 'profession:challenge':
      next = { ...p, challenges: p.challenges + 1 }
      break
    case 'profession:practice':
      next = { ...p, practiceWeeks: p.practiceWeeks + 1 }
      break
    case 'profession:mission':
      next = { ...p, missions: a.done ? 1 : 0 }
      break
    case 'profession:advance':
      if (!professionProgress(c, p.id).canAdvance) throw new RuleError('not_ready', `${p.name} has not met its advancement requirements`)
      next = { ...p, rank: p.rank + 1, challenges: 0, missions: 0, practiceWeeks: 0 }
      break
  }
  return { ...c, professions: c.professions.map((x) => (x === p ? next : x)) }
}
