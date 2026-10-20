// Ruling 8: the character a builder draft shows. Pure and deterministic (INV-PURE, INV-DET).
import { applyAction, type ActionCatalogue } from './actions'
import type { Catalogue } from './catalogue'
import { createCharacter } from './create'
import { RuleError } from './types'
import type { Character, DraftState } from './types'

export type InvalidDraftAction = { actionId: string; error: RuleError }

/**
 * `createCharacter(builder)`, then each pending action in order. An action the rules now refuse (for example
 * after an edit to an earlier step) is skipped and listed with its refusal; the rest still apply. A builder
 * `createCharacter` refuses throws that `RuleError`.
 */
export function previewDraft(draft: DraftState, catalogue: Catalogue): { character: Character; invalid: InvalidDraftAction[] } {
  const actions: ActionCatalogue = catalogue
  let character = createCharacter(draft.builder, catalogue)
  const invalid: InvalidDraftAction[] = []
  for (const action of draft.pending) {
    try {
      character = applyAction(character, action, actions).character
    } catch (error) {
      if (!(error instanceof RuleError)) throw error
      invalid.push({ actionId: action.id, error })
    }
  }
  return { character, invalid }
}
