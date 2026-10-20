import { useState, type FormEvent } from 'react'
import type { Wound } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@heartrush/ui/components/dialog'
import { Input } from '@heartrush/ui/components/input'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

/** Which dialog is open: a new wound, editing one (rank, description, remove), or treating one (the medicine roll). */
type Open = { kind: 'add' } | { kind: 'edit'; wound: Wound } | { kind: 'treat'; wound: Wound } | null

const digits = (s: string) => s.replace(/\D/g, '').slice(0, 3)
const asNumber = (s: string) => (/^\d+$/.test(s) ? Number(s) : null)

/**
 * Wounds: the heading carries the max-HP penalty, the Fast Healer age benefit shows its reminder (healing by days
 * happens at the table), and each row shows its rank and description. With edit rights: **+** adds a wound, tapping
 * the rank edits rank and description (with **Remove** as the GM correction), and **Treat** asks for the medicine roll
 * and sends one `wound:treat`.
 */
export function WoundsSection({ character, derived, dispatch, canEdit }: SectionProps) {
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)
  const heading = derived.woundPenalty > 0 ? `Wounds (−${derived.woundPenalty} max HP)` : 'Wounds'
  const fastHealer = character.identity.ageBenefits.includes('fast-healer')

  return (
    <Section
      title={heading}
      action={
        canEdit && (
          <Button type="button" variant="ghost" className="min-h-11 min-w-11 px-3 text-h4" aria-label="Add a wound" onClick={() => setOpen({ kind: 'add' })}>
            +
          </Button>
        )
      }
    >
      {fastHealer && <p className="text-ui text-muted-foreground">Fast Healer: wounds heal twice as fast.</p>}
      {character.wounds.length === 0 ? (
        <p className="text-ui text-muted-foreground">No wounds.</p>
      ) : (
        <ul className="flex flex-col">
          {character.wounds.map((w) => (
            <li key={w.id} className="flex min-h-11 items-center gap-3 border-b border-border last:border-b-0">
              {canEdit ? (
                <button
                  type="button"
                  className="-ml-2 min-h-11 min-w-11 shrink-0 rounded-sm px-2 text-left font-sans text-control font-semibold tabular-nums text-wound hover:bg-surface-muted"
                  aria-label={`Edit wound of rank ${w.rank}`}
                  onClick={() => setOpen({ kind: 'edit', wound: w })}
                >
                  {w.rank}
                </button>
              ) : (
                <span className="w-8 shrink-0 font-sans text-control font-semibold tabular-nums text-wound">{w.rank}</span>
              )}
              <span className="min-w-0 flex-1 truncate text-ui">{w.description || <span className="text-muted-foreground">No description</span>}</span>
              {w.treated ? (
                <span className="shrink-0 text-meta text-muted-foreground">treated ✓</span>
              ) : (
                canEdit && (
                  <Button type="button" variant="outline" className="min-h-11 shrink-0 px-4" onClick={() => setOpen({ kind: 'treat', wound: w })}>
                    Treat
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent showClose={false}>
          {open?.kind === 'add' && <AddWound onCancel={close} onSave={(wound) => (close(), void dispatch({ kind: 'wound:add', wound }))} />}
          {open?.kind === 'edit' && (
            <EditWound
              wound={open.wound}
              onCancel={close}
              onSave={(wound) => (close(), void dispatch({ kind: 'wound:edit', wound }))}
              onRemove={() => (close(), void dispatch({ kind: 'wound:remove', woundId: open.wound.id }))}
            />
          )}
          {open?.kind === 'treat' && (
            <TreatWound wound={open.wound} onCancel={close} onTreat={(medicineRoll) => (close(), void dispatch({ kind: 'wound:treat', woundId: open.wound.id, medicineRoll }))} />
          )}
        </DialogContent>
      </Dialog>
    </Section>
  )
}

function RankField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex flex-col gap-1 text-ui font-medium">
      {label}
      <Input inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={value} onChange={(e) => onChange(digits(e.target.value))} className="h-12 w-24 tabular-nums" />
    </label>
  )
}

function DescriptionField({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-ui font-medium">
      Description
      <Input placeholder="e.g. fractured leg" autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} className="h-12" />
    </label>
  )
}

function AddWound({ onCancel, onSave }: { onCancel: () => void; onSave: (wound: { rank: number; description: string }) => void }) {
  const [rank, setRank] = useState('')
  const [description, setDescription] = useState('')
  const n = asNumber(rank)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (n !== null && n >= 1) onSave({ rank: n, description: description.trim() })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader className="pr-0">
        <DialogTitle>Add a wound</DialogTitle>
        <DialogDescription>A wound lowers max HP by its rank until it heals.</DialogDescription>
      </DialogHeader>
      <RankField label="Rank" value={rank} onChange={setRank} />
      <DescriptionField value={description} onChange={setDescription} />
      <DialogFooter>
        <Button type="button" variant="ghost" className="min-h-12" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-12 px-6" disabled={n === null || n < 1}>
          Add
        </Button>
      </DialogFooter>
    </form>
  )
}

function EditWound({
  wound,
  onCancel,
  onSave,
  onRemove,
}: {
  wound: Wound
  onCancel: () => void
  onSave: (wound: { id: string; rank: number; description: string }) => void
  onRemove: () => void
}) {
  const [rank, setRank] = useState(String(wound.rank))
  const [description, setDescription] = useState(wound.description)
  const n = asNumber(rank)
  const changed = n !== wound.rank || description.trim() !== wound.description
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (n !== null && n >= 1 && changed) onSave({ id: wound.id, rank: n, description: description.trim() })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader className="pr-0">
        <DialogTitle>Edit wound</DialogTitle>
        <DialogDescription>Correct the rank or description. Remove takes the wound off the sheet entirely.</DialogDescription>
      </DialogHeader>
      <RankField label="Rank" value={rank} onChange={setRank} />
      <DescriptionField value={description} onChange={setDescription} />
      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="outline" className="min-h-12 text-primary" onClick={onRemove}>
          Remove wound
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="ghost" className="min-h-12" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="min-h-12 px-6" disabled={n === null || n < 1 || !changed}>
            Save
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

function TreatWound({ wound, onCancel, onTreat }: { wound: Wound; onCancel: () => void; onTreat: (roll: number) => void }) {
  const [roll, setRoll] = useState('')
  const n = asNumber(roll)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (n !== null) onTreat(n)
  }
  const result = n === null ? null : n >= wound.rank ? 'The wound closes and is removed.' : `Rank ${wound.rank} → ${wound.rank - n}, treated.`
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader className="pr-0">
        <DialogTitle>Treat wound of rank {wound.rank}</DialogTitle>
        <DialogDescription>Enter the medicine roll. The rank drops by the roll; a wound is treated once.</DialogDescription>
      </DialogHeader>
      <label className="flex flex-col gap-1 text-ui font-medium">
        Medicine roll
        <Input autoFocus inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={roll} onChange={(e) => setRoll(digits(e.target.value))} className="h-12 w-24 tabular-nums" />
      </label>
      <p className="min-h-5 text-ui text-muted-foreground" aria-live="polite">
        {result}
      </p>
      <DialogFooter>
        <Button type="button" variant="ghost" className="min-h-12" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-12 px-6" disabled={n === null}>
          Treat
        </Button>
      </DialogFooter>
    </form>
  )
}
