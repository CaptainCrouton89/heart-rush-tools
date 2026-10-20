import { useCallback } from 'react'
import { ulid } from 'ulid'
import type { ClientAction } from '@heartrush/rules-engine/types'
import { getCatalogue } from '~/catalogue'
import { GearEditor } from '~/components/edit/GearEditor'
import type { ActionDraft } from '~/components/sheet/use-character'
import type { UseDraft } from './use-draft'

/**
 * Step 7 (Gear): S3's gear editor over the draft's preview character. Each change is one `gear:*` action, stamped here
 * (INV-DET) and appended to the draft's pending list; it becomes an ordinary event at Finish (ruling 8).
 */
export function StepGear({ draft }: { draft: UseDraft }) {
  const { setPending } = draft
  const append = useCallback(
    (action: ActionDraft) => setPending((p) => [...p, { ...action, id: ulid(), at: new Date().toISOString() } as ClientAction]),
    [setPending],
  )
  const character = draft.preview.character
  if (!character) {
    return <p className="text-ui text-muted-foreground">Finish steps 1–5 first; your carrying capacity depends on them.</p>
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="font-serif text-body-sm text-muted-foreground">Weapons, armor, shield, items and coins. You can also change gear later from the sheet.</p>
      <GearEditor value={character} catalogue={getCatalogue()} onChange={append} />
    </div>
  )
}
