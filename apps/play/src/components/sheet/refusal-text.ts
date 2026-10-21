// Plain-words text for every refusal the character server or the rules engine can give, and the one string for
// a write that never reached the server. The tables are exhaustive over `CharacterErrorCode | RuleErrorCode`,
// so a code added to the engine or to C1 fails `tsc` here until it has words.
import type { RuleErrorCode } from '@heartrush/rules-engine/types'
import type { CharacterErrorCode } from '../../server/characters'

/** The chip text for a write that failed on the network or with a 5xx (design: no offline queue). */
export const NO_CONNECTION_TEXT = 'Not saved — no connection'

type Code = CharacterErrorCode | RuleErrorCode

/** The reason, written to follow "Couldn't apply: ". */
const REASON: Record<Code, string> = {
  // character server
  forbidden: "you can't edit this character",
  not_found: 'that is no longer on the sheet',
  bad_input: 'the request was not understood',
  bad_action: "the sheet can't do that",
  conflict: 'someone else changed this sheet at the same moment, so nothing was saved. Try again',
  duplicate_action: 'that change was already saved',
  duplicate_id: 'a character with that id already exists',
  not_a_draft: 'this character is already finished',
  is_draft: 'this character is not finished yet',
  not_top_of_stack: 'only the latest change can be undone',
  draft_invalid: 'a step in the draft is no longer allowed',
  // pricing
  aspect_cap: 'that aspect is already at its highest rank',
  die_cap: 'that die is already as large as it can go',
  not_attuned: "the character isn't attuned to that element",
  insufficient_xp: 'not enough XP',
  path_locked: 'a path needs 50 XP earned and a character takes only one',
  no_path: 'the character has not chosen a path',
  tier_cap: 'the path is already at its top tier',
  // reducers
  invalid_amount: "that amount isn't allowed",
  not_enough_rush: 'not enough rush points',
  not_enough_dp: 'not enough DP',
  stamina_spent: 'the heart die was already spent this round',
  heart_die_floor: "the heart die can't go below d4",
  heart_die_over_max: "that is bigger than the character's largest heart die",
  wrong_rolled_count: 'the wrong number of sleep conditions was picked',
  bloodmark_not_owed: 'no bloodmark ability of that kind is owed at this level',
  not_ready: "that profession hasn't met its advancement requirements",
  // createCharacter
  unknown_race: 'that race is not in the rulebook',
  unknown_subrace: 'that subrace is not in the rulebook',
  invalid_age_benefits: "the age benefits don't fit the character",
  invalid_dice: 'assign two d6 and two d4',
  invalid_professions: "the professions don't add up",
  kin_choice: 'a choice from the character\'s race is missing or not allowed',
  // undo and client input
  bad_roll: "that roll isn't valid",
}

/** For these the engine's own message says what is wrong, so it wins over the generic line when it is not just the code. */
const SPECIFIC_MESSAGE: ReadonlySet<Code> = new Set<Code>(['bad_action', 'not_found', 'kin_choice', 'invalid_amount'])

const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1)

/** The reason alone, lower case, no trailing full stop (except where the table's line carries its own sentence). */
export function refusalReason(code: Code, message?: string): string {
  const specific = message?.trim()
  if (SPECIFIC_MESSAGE.has(code) && specific && specific !== code) return lowerFirst(specific.replace(/\.$/, ''))
  return REASON[code] ?? lowerFirst(specific || String(code))
}

/** The chip text for a refusal: "Couldn't apply: not enough rush points" (`doing` is "undo" for an undo). */
export function refusalText(code: Code, message?: string, doing: 'apply' | 'undo' = 'apply'): string {
  return `Couldn't ${doing}: ${refusalReason(code, message)}`
}
