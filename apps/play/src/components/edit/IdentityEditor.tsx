import type { Identity } from '@heartrush/rules-engine/types'
import type { ActionDraft } from '~/components/sheet/use-character'
import { CommitText, Field } from './fields'

type Editable = 'name' | 'pronouns' | 'dream' | 'description' | 'motivation' | 'portrait'

const TEXT: { id: Exclude<Editable, 'portrait'>; label: string; multiline?: boolean }[] = [
  { id: 'name', label: 'Name' },
  { id: 'pronouns', label: 'Pronouns' },
  { id: 'dream', label: 'Dream', multiline: true },
  { id: 'description', label: 'Description', multiline: true },
  { id: 'motivation', label: 'Motivation', multiline: true },
]

/**
 * The descriptive identity fields, each committed as one `identity:set` on blur. Age category and age benefits are
 * fixed once the builder finishes, so they are not here. The portrait is an image URL; blank clears it.
 */
export function IdentityEditor({ value, onChange }: { value: Identity; onChange: (action: ActionDraft) => unknown }) {
  return (
    <div className="flex flex-col gap-4">
      {TEXT.map((f) => (
        <Field key={f.id} label={f.label}>
          {(id) => <CommitText id={id} multiline={f.multiline} value={value[f.id]} onCommit={(text) => onChange({ kind: 'identity:set', identity: { [f.id]: text } })} />}
        </Field>
      ))}
      <Field label="Portrait image URL">
        {(id) => (
          <CommitText
            id={id}
            value={value.portrait ?? ''}
            placeholder="https://…"
            onCommit={(text) => onChange({ kind: 'identity:set', identity: { portrait: text.trim() || null } })}
          />
        )}
      </Field>
    </div>
  )
}
