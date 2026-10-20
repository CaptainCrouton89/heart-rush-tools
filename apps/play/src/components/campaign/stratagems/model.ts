// Shared by the stratagem card and form: labels and the conversion from what the server shows to what it accepts.
import type { AssetKind, ObjectiveInput, ObjectiveState, StratagemStatus, StratagemView } from '~/server/campaign-play'

export const STATUS_LABEL: Record<StratagemStatus, string> = { active: 'Active', finished: 'Finished', abandoned: 'Abandoned' }
export const STATE_LABEL: Record<ObjectiveState, string> = { open: 'Open', done: 'Done', gone: 'Gone' }
export const KIND_LABEL: Record<AssetKind, string> = { asset: 'Asset', hindrance: 'Hindrance' }

/** The objective's name on screen: its title, or "Unknown objective" for an unrevealed slot. */
export const objectiveTitle = (title: string) => title.trim() || 'Unknown objective'

/** The feed's label for an objective roll, as the roll server writes it: "Take Thornwall — Cut the supply road". */
export const objectiveLabel = (goal: string, title: string) => `${goal} — ${objectiveTitle(title)}`

/**
 * The stored objective list, ready to write back. A leader whose character has left the campaign (the server shows no
 * `leaderName` for it) is written as no leader: the server refuses a leader outside the campaign, and that character
 * can no longer roll the objective anyway.
 */
export const objectiveInputs = (s: StratagemView): ObjectiveInput[] =>
  s.objectives.map((o) => ({ title: o.title, cn: o.cn, leaderCharacterId: o.leaderName === null ? null : o.leaderCharacterId, state: o.state }))
