import { NotesText } from '~/components/sheet/NotesSection'
import type { ActionDraft } from '~/components/sheet/use-character'
import { CommitText, Field } from './fields'

/** The notes box (markdown), committed as one `notes:set` on blur, with the sheet's rendering of it below. */
export function NotesEditor({ value, onChange }: { value: string; onChange: (action: ActionDraft) => unknown }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Notes (markdown)">
        {(id) => <CommitText id={id} multiline value={value} className="min-h-48" onCommit={(notes) => onChange({ kind: 'notes:set', notes })} />}
      </Field>
      {value.trim() && (
        <div className="flex flex-col gap-1">
          <span className="eyebrow">As the sheet shows it</span>
          <NotesText markdown={value} />
        </div>
      )}
    </div>
  )
}
