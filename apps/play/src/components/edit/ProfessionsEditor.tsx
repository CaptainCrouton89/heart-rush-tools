import { useState, type FormEvent } from 'react'
import type { Profession } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import type { ActionDraft } from '~/components/sheet/use-character'
import { CommitNumber, CommitText, Field } from './fields'

/** The engine's highest stored profession rank (`profession:*` refuses a rank above it). */
const MAX_RANK = 7

/**
 * Add, rename, correct the rank of and remove professions (`profession:add|edit|remove`). The progress counters and
 * Advance live on the sheet's profession rows; the rank field here is a correction, not an advance.
 */
export function ProfessionsEditor({ value, onChange }: { value: Profession[]; onChange: (action: ActionDraft) => unknown }) {
  const [name, setName] = useState('')
  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onChange({ kind: 'profession:add', profession: { name: name.trim() } })
    setName('')
  }
  return (
    <div className="flex flex-col gap-4">
      {value.length === 0 ? (
        <p className="text-ui text-muted-foreground">No professions.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {value.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0">
              <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-3">
                <Field label="Profession">
                  {(id) => <CommitText id={id} value={p.name} onCommit={(text) => onChange({ kind: 'profession:edit', profession: { id: p.id, name: text } })} />}
                </Field>
                <Field label="Rank">
                  {(id) => (
                    <CommitNumber id={id} value={p.rank} max={MAX_RANK} onCommit={(rank) => onChange({ kind: 'profession:edit', profession: { id: p.id, rank } })} />
                  )}
                </Field>
              </div>
              <div className="flex min-h-11 items-center justify-between gap-3">
                {p.rerollOnes ? <span className="text-meta text-muted-foreground">Wisdom of Experience: reroll 1s</span> : <span />}
                <Button type="button" variant="outline" className="h-11" aria-label={`Remove ${p.name || 'profession'}`} onClick={() => onChange({ kind: 'profession:remove', professionId: p.id })}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} aria-label="New profession" className="flex items-end gap-2">
        <Field label="New profession" className="flex-1">
          {(id) => <Input id={id} value={name} placeholder="Blacksmith" onChange={(e) => setName(e.target.value)} className="h-11" />}
        </Field>
        <Button type="submit" variant="outline" className="h-11" disabled={!name.trim()}>
          Add
        </Button>
      </form>
    </div>
  )
}
