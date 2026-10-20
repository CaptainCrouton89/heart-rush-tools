import { useState, type FormEvent } from 'react'
import { CONDITION } from '@heartrush/rules-engine/conditions'
import type { HeartDie } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@heartrush/ui/components/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@heartrush/ui/components/dropdown-menu'
import { Input } from '@heartrush/ui/components/input'
import type { SectionProps } from './SheetLayout'

const HEART_DICE: readonly HeartDie[] = [4, 6, 8, 10, 12, 20]
const WOUND_AT = 10

const SPEND: { effect: 'endure' | 'focus' | 'surge'; label: string; text: string }[] = [
  { effect: 'endure', label: 'Endure', text: 'Halve incoming damage (round up)' },
  { effect: 'focus', label: 'Focus', text: 'Set one die of a roll to its maximum' },
  { effect: 'surge', label: 'Surge', text: 'Gain a full action this action phase' },
]

/** Menu rows are 44 px tall on the sheet (INV-UI tap targets). */
const ITEM = 'min-h-11'

/** The sum of every Burning level on the character (rows of one condition may be split by source). */
export function burningLevels(conditions: SectionProps['character']['conditions']): number {
  return conditions.reduce((n, k) => n + (k.conditionId === CONDITION.burning ? (k.level ?? 1) : 0), 0)
}

/**
 * The fight controls under the damage pad: the heart die (Spend ▾ Endure / Focus / Surge, greyed after one spend this
 * round or at d4; the die's ▾ sets it by hand up to the largest heart die), rush points, the round with **Next round**
 * (asking for Burning damage first) and **End fight**, and DP with **Start session** and the complication button.
 * Without `canEdit` the values show and the controls do not.
 */
export function FightControls({ character, derived, dispatch, canEdit }: SectionProps) {
  const { play, hp } = character
  const [burning, setBurning] = useState<{ levels: number; amount: string; description: string } | null>(null)

  const spentThisRound = play.staminaSpentRound === play.round
  const atFloor = hp.heartDieCurrent === 4
  const spendBlocked = spentThisRound ? 'Spent this round' : atFloor ? 'No stamina left at d4' : null

  const nextRound = () => {
    const levels = burningLevels(character.conditions)
    if (levels > 0) return setBurning({ levels, amount: '', description: '' })
    void dispatch({ kind: 'nextRound' })
  }
  const burnAmount = burning && /^\d+$/.test(burning.amount) ? Number(burning.amount) : 0
  const takeBurn = (e: FormEvent) => {
    e.preventDefault()
    if (!burning || burnAmount < 1) return
    const description = burnAmount >= WOUND_AT ? burning.description.trim() : undefined
    void dispatch({ kind: 'damage', amount: burnAmount, ...(description !== undefined ? { woundDescription: description } : {}) })
    void dispatch({ kind: 'nextRound' })
    setBurning(null)
  }
  const skipBurn = () => {
    setBurning(null)
    void dispatch({ kind: 'nextRound' })
  }

  const dpStep = play.dpPerComplication

  return (
    <section aria-label="Fight controls" className="flex flex-col gap-3 font-sans text-control tabular-nums">
      {/* Heart die and rush */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Heart die</span>
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 px-3 font-semibold" aria-label={`Heart die d${hp.heartDieCurrent}. Set it by hand`}>
                  d{hp.heartDieCurrent} <span aria-hidden="true">▾</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Set the heart die (largest d{derived.maxHeartDie})</DropdownMenuLabel>
                {HEART_DICE.filter((d) => d <= derived.maxHeartDie).map((d) => (
                  <DropdownMenuItem key={d} className={ITEM} disabled={d === hp.heartDieCurrent} onSelect={() => void dispatch({ kind: 'heartDie:set', value: d })}>
                    d{d}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="font-semibold">d{hp.heartDieCurrent}</span>
          )}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 px-3" disabled={spendBlocked !== null}>
                  Spend <span aria-hidden="true">▾</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Drop the heart die one size to…</DropdownMenuLabel>
                {SPEND.map((s) => (
                  <DropdownMenuItem key={s.effect} className={`${ITEM} flex-col items-start gap-0`} onSelect={() => void dispatch({ kind: 'heartDie:spend', effect: s.effect })}>
                    <span className="font-medium">{s.label}</span>
                    <span className="text-meta text-muted-foreground">{s.text}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canEdit && spendBlocked && <span className="text-meta text-muted-foreground">{spendBlocked}</span>}
        </div>

        <Stepper
          label="Rush"
          value={play.rushPoints}
          canEdit={canEdit}
          min={0}
          onChange={(value) => void dispatch({ kind: 'rush:set', value })}
        />
      </div>

      {/* Round */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1">
          <span className="eyebrow mr-2">Round</span>
          <span className="font-semibold">{play.round}</span>
        </span>
        {canEdit && (
          <>
            <Button className="h-12 px-4" onClick={nextRound}>
              Next round
            </Button>
            <Button variant="outline" className="h-12 px-4" onClick={() => void dispatch({ kind: 'endFight' })}>
              End fight
            </Button>
          </>
        )}
      </div>

      {/* DP */}
      <div className="flex flex-wrap items-center gap-2">
        <Stepper label="DP" value={play.dp} canEdit={canEdit} min={0} max={10} onChange={(value) => void dispatch({ kind: 'dp:set', value })} />
        {canEdit && dpStep === 2 && (
          <Button variant="outline" className="h-11 px-3" disabled={play.dp >= 10} onClick={() => void dispatch({ kind: 'dp:set', value: Math.min(10, play.dp + 2) })}>
            Complication: +2 DP
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" className="h-11 px-3" onClick={() => void dispatch({ kind: 'startSession' })}>
            Start session
          </Button>
        )}
      </div>

      <Dialog open={burning !== null} onOpenChange={(open) => !open && setBurning(null)}>
        <DialogContent showClose={false}>
          <form onSubmit={takeBurn} className="flex flex-col gap-4">
            <DialogHeader className="pr-0">
              <DialogTitle>
                Burning {burning?.levels}: take {burning?.levels}d6
              </DialogTitle>
              <DialogDescription>
                Roll {burning?.levels}d6 and enter the total, or skip. Then the round advances and fading conditions drop a level.
              </DialogDescription>
            </DialogHeader>
            <Input
              aria-label="Burning damage"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoFocus
              placeholder="0"
              value={burning?.amount ?? ''}
              onChange={(e) => setBurning((b) => (b ? { ...b, amount: e.target.value.replace(/\D/g, '').slice(0, 3) } : b))}
              className="h-12 w-24 text-center font-semibold tabular-nums"
            />
            {burnAmount >= WOUND_AT && (
              <label className="flex flex-col gap-1 text-ui">
                Wound of rank {burnAmount} — describe it
                <Input
                  placeholder="e.g. burned arm"
                  value={burning?.description ?? ''}
                  onChange={(e) => setBurning((b) => (b ? { ...b, description: e.target.value } : b))}
                  className="h-12"
                />
              </label>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" className="min-h-12" onClick={skipBurn}>
                Skip
              </Button>
              <Button type="submit" className="min-h-12 px-6" disabled={burnAmount < 1}>
                Damage
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/** A number with − and + (one tap each, always undoable). */
function Stepper({
  label, value, canEdit, min, max, onChange,
}: { label: string; value: number; canEdit: boolean; min: number; max?: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow">{label}</span>
      {canEdit && (
        <Button variant="outline" className="size-11 text-h4" aria-label={`${label} one less`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </Button>
      )}
      <span className="min-w-6 text-center font-semibold" aria-label={`${label} ${value}`}>
        {value}
      </span>
      {canEdit && (
        <Button
          variant="outline"
          className="size-11 text-h4"
          aria-label={`${label} one more`}
          disabled={max !== undefined && value >= max}
          onClick={() => onChange(value + 1)}
        >
          +
        </Button>
      )}
    </div>
  )
}
