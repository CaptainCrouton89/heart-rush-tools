import { ulid } from 'ulid'
import { bloodmarkPicksOwed } from '@heartrush/rules-engine/bloodmarks'
import type { Character, ClientAction } from '@heartrush/rules-engine/types'
import { BloodmarkPicks } from '~/components/advance/BloodmarkPicks'
import { Section } from '~/components/sheet/SheetLayout'
import type { ActionDraft, Outcome } from '~/components/sheet/use-character'
import type { UseDraft } from './use-draft'

/**
 * Step 6's **Bloodmark abilities** panel (design "Builder"): for bloodmark level ≥ 1, the picks owed at that level and
 * X1's form for taking one. A pick is stamped here (INV-DET) and appended to the draft's pending list; nothing is sent
 * to the server until Finish. A pick the rules refuse shows in the builder's refused list (ruling 8).
 */
export function BloodmarkPanel({ draft, character }: { draft: UseDraft; character: Character }) {
  if (character.bloodmarks.level < 1) return null
  const dispatch = async (action: ActionDraft): Promise<Outcome> => {
    const stamped = { ...action, id: ulid(), at: new Date().toISOString() } as ClientAction
    draft.setPending((pending) => [...pending, stamped])
    // BloodmarkPicks reads only `status` (to clear its form); a draft append has no saved document to report.
    return { status: 'saved', action: stamped, rebased: false } as unknown as Outcome
  }
  return (
    <Section title="Bloodmark abilities">
      <BloodmarkPicks character={character} owed={bloodmarkPicksOwed(character)} dispatch={dispatch} />
    </Section>
  )
}
