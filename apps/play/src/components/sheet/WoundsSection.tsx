import { useState, type FormEvent } from 'react'
import type { Wound } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

/** Which row is open: a blank row for a new wound, one wound being edited (rank, description, remove), or one being treated. */
type Open = { kind: 'add' } | { kind: 'edit'; id: string } | { kind: 'treat'; id: string } | null

const digits = (s: string) => s.replace(/\D/g, '').slice(0, 3)
const asNumber = (s: string) => (/^\d+$/.test(s) ? Number(s) : null)

/**
 * Wounds: the heading carries the max-HP penalty, the Fast Healer age benefit shows its reminder (healing by days
 * happens at the table), and each row shows its rank and description. With edit rights everything happens in the
 * list: **+** opens a blank row (rank, description, Add); tapping the rank turns that row into its edit form (with
 * **Remove** as the GM correction); **Treat** opens the medicine roll under the row and sends one `wound:treat`.
 */
export function WoundsSection({ character, derived, dispatch, canEdit }: SectionProps) {
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)
  const heading = derived.woundPenalty > 0 ? `Wounds (−${derived.woundPenalty} max HP)` : 'Wounds'
  const fastHealer = character.identity.ageBenefits.includes('fast-healer')
  const adding = open?.kind === 'add'

  return (
    <Section
      title={heading}
      action={
        canEdit && (
          <Button size="compact-icon" type="button" variant="ghost" aria-label="Add a wound" aria-expanded={adding} onClick={() => setOpen(adding ? null : { kind: 'add' })}>
            +
          </Button>
        )
      }
    >
      {fastHealer && <p className="text-ui text-muted-foreground">Fast Healer: wounds heal twice as fast.</p>}
      {character.wounds.length === 0 && !adding ? (
        <p className="text-ui text-muted-foreground">No wounds.</p>
      ) : (
        <ul className="flex flex-col">
          {adding && (
            <li className="reveal border-b border-border last:border-b-0">
              <WoundForm
                initial={{ rank: '', description: '' }}
                submitLabel="Add"
                onCancel={close}
                onSave={(wound) => (close(), void dispatch({ kind: 'wound:add', wound }))}
              />
            </li>
          )}
          {character.wounds.map((w) => {
            const editing = open?.kind === 'edit' && open.id === w.id
            const treating = open?.kind === 'treat' && open.id === w.id
            if (editing) {
              return (
                <li key={w.id} className="reveal border-b border-border last:border-b-0">
                  <WoundForm
                    initial={{ rank: String(w.rank), description: w.description }}
                    original={w}
                    submitLabel="Save"
                    onCancel={close}
                    onSave={(wound) => (close(), void dispatch({ kind: 'wound:edit', wound: { id: w.id, ...wound } }))}
                    onRemove={() => (close(), void dispatch({ kind: 'wound:remove', woundId: w.id }))}
                  />
                </li>
              )
            }
            return (
              <li key={w.id} className="flex min-h-12 flex-wrap items-center gap-x-3 border-b border-border last:border-b-0">
                {canEdit ? (
                  <button
                    type="button"
                    className="relative min-w-9 shrink-0 rounded-sm text-center font-sans text-control font-semibold tabular-nums text-wound after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-[''] hover:bg-surface-muted"
                    aria-label={`Edit wound of rank ${w.rank}`}
                    onClick={() => setOpen({ kind: 'edit', id: w.id })}
                  >
                    {w.rank}
                  </button>
                ) : (
                  <span className="min-w-9 shrink-0 text-center font-sans text-control font-semibold tabular-nums text-wound">{w.rank}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-ui">{w.description || <span className="text-muted-foreground">No description</span>}</span>
                {w.treated ? (
                  <span className="shrink-0 text-meta text-muted-foreground">treated ✓</span>
                ) : (
                  canEdit &&
                  !treating && (
                    <Button size="compact" type="button" variant="line" className="shrink-0" onClick={() => setOpen({ kind: 'treat', id: w.id })}>
                      Treat
                    </Button>
                  )
                )}
                {treating && (
                  <div className="reveal basis-full">
                    <TreatRow
                      wound={w}
                      onCancel={close}
                      onTreat={(medicineRoll) => (close(), void dispatch({ kind: 'wound:treat', woundId: w.id, medicineRoll }))}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

/** A wound's rank and description as a row of blanks: the new-wound row (+) and the edit row (tap the rank). */
function WoundForm({
  initial,
  original,
  submitLabel,
  onCancel,
  onSave,
  onRemove,
}: {
  initial: { rank: string; description: string }
  original?: Wound
  submitLabel: string
  onCancel: () => void
  onSave: (wound: { rank: number; description: string }) => void
  onRemove?: () => void
}) {
  const [rank, setRank] = useState(initial.rank)
  const [description, setDescription] = useState(initial.description)
  const n = asNumber(rank)
  const changed = !original || n !== original.rank || description.trim() !== original.description
  const valid = n !== null && n >= 1 && changed
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (valid) onSave({ rank: n, description: description.trim() })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-1 py-1.5">
      <div className="flex min-h-12 items-center gap-2.5">
        <Input
          aria-label="Rank"
          placeholder="Rank"
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={rank}
          onChange={(e) => setRank(digits(e.target.value))}
          className="h-9 w-14 shrink-0 px-1 text-center tabular-nums"
        />
        <Input aria-label="Description" placeholder="Describe it" value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 min-w-0 flex-1" />
        <Button size="compact" variant="line-primary" type="submit" disabled={!valid}>
          {submitLabel}
        </Button>
        <Button size="compact-icon" type="button" variant="ghost" className="text-muted-foreground" aria-label="Cancel" onClick={onCancel}>
          ✕
        </Button>
      </div>
      {onRemove && (
        <Button size="compact" type="button" variant="ghost" className="self-start px-0 text-primary" onClick={onRemove}>
          Remove wound
        </Button>
      )}
    </form>
  )
}

/** The medicine roll, opened inside the wound's row by **Treat**. */
function TreatRow({ wound, onCancel, onTreat }: { wound: Wound; onCancel: () => void; onTreat: (roll: number) => void }) {
  const [roll, setRoll] = useState('')
  const n = asNumber(roll)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (n !== null) onTreat(n)
  }
  const result =
    n === null ? `The rank drops by the roll; a roll of ${wound.rank} or more heals it.` : n >= wound.rank ? 'The wound closes and is removed.' : `Rank ${wound.rank} → ${wound.rank - n}, treated.`
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pb-2 pl-12">
      <label htmlFor={`treat-${wound.id}`} className="text-meta text-muted-foreground">
        Medicine roll
      </label>
      <Input
        id={`treat-${wound.id}`}
        autoFocus
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        placeholder="0"
        value={roll}
        onChange={(e) => setRoll(digits(e.target.value))}
        className="h-9 w-14 px-1 text-center tabular-nums"
      />
      <Button size="compact" variant="line-primary" type="submit" disabled={n === null}>
        Treat
      </Button>
      <Button size="compact-icon" type="button" variant="ghost" className="text-muted-foreground" aria-label="Cancel" onClick={onCancel}>
        ✕
      </Button>
      <p className="basis-full text-meta text-muted-foreground" aria-live="polite">
        {result}
      </p>
    </form>
  )
}
