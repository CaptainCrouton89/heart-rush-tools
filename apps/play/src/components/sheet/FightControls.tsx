import { useState, type FormEvent } from 'react'
import { CONDITION, hasCondition } from '@heartrush/rules-engine/conditions'
import { suffocationStep } from '@heartrush/rules-engine/reducers/combat'
import type { HeartDie } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@heartrush/ui/components/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@heartrush/ui/components/dropdown-menu'
import { Input } from '@heartrush/ui/components/input'
import type { SectionProps } from './SheetLayout'
import { Written } from '~/components/motion'

const HEART_DICE: readonly HeartDie[] = [4, 6, 8, 10, 12, 20]
const WOUND_AT = 10

// Focus is spent on a roll result (`RollResult`), where the die it sets to its maximum is picked.
const SPEND: { effect: 'endure' | 'surge'; label: string; text: string }[] = [
  { effect: 'endure', label: 'Endure', text: 'Halve incoming damage (round up)' },
  { effect: 'surge', label: 'Surge', text: 'Gain a full action this action phase' },
]

/** Menu rows are 44 px tall on the sheet (INV-UI tap targets). */
const ITEM = 'min-h-11'

/** The sum of every Burning level on the character (rows of one condition may be split by source). */
export function burningLevels(conditions: SectionProps['character']['conditions']): number {
  return conditions.reduce((n, k) => n + (k.conditionId === CONDITION.burning ? (k.level ?? 1) : 0), 0)
}

/**
 * The fight controls under the damage pad. At 0 HP or below (`Combat.md` Zero Hit points): the death threshold and, while
 * not Unconscious, **Go unconscious** ("or in 10 minutes"). Then the heart die (Spend ▾ lists Endure / Surge under the row,
 * greyed after one spend this round, at d4 or while Suffocating; Focus is on a roll result; the die's ▾ sets it by hand up to
 * the largest heart die), rush points, the round with **Next round** (asking for Burning damage first; it sets rush to the
 * new round and applies Suffocating's round-end step) and **End fight**, and DP with **Start session** (spending and gaining
 * DP through an aspect is on the Aspects section). Without `canEdit` the values show and the controls do not.
 */
export function FightControls({ character, derived, dispatch, canEdit }: SectionProps) {
  const { play, hp } = character
  const [spending, setSpending] = useState(false)
  const [burning, setBurning] = useState<{ levels: number; amount: string; description: string } | null>(null)

  const spentThisRound = play.staminaSpentRound === play.round
  const atFloor = hp.heartDieCurrent === 4
  const suffocating = hasCondition(character, CONDITION.suffocating)
  const unconscious = hasCondition(character, CONDITION.unconscious)
  const spendBlocked = spentThisRound ? 'Spent this round' : atFloor ? 'No stamina left at d4' : suffocating ? 'No stamina while suffocating' : null
  const atZero = hp.current <= 0

  // Suffocating's step is computed here so the history line can name it; damage from Burning does not change it.
  const advance = () => void dispatch({ kind: 'nextRound', suffocation: suffocationStep(character) })
  const nextRound = () => {
    const levels = burningLevels(character.conditions)
    if (levels > 0) return setBurning({ levels, amount: '', description: '' })
    advance()
  }
  const burnAmount = burning && /^\d+$/.test(burning.amount) ? Number(burning.amount) : 0
  const takeBurn = (e: FormEvent) => {
    e.preventDefault()
    if (!burning || burnAmount < 1) return
    const description = burnAmount >= WOUND_AT ? burning.description.trim() : undefined
    void dispatch({ kind: 'damage', amount: burnAmount, ...(description !== undefined ? { woundDescription: description } : {}) })
    advance()
    setBurning(null)
  }
  const skipBurn = () => {
    setBurning(null)
    advance()
  }

  return (
    <section aria-label="Fight controls" className="flex flex-col gap-1 font-sans text-control">
      {atZero && (
        <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-semibold text-primary">At {hp.current < 0 ? `−${-hp.current}` : 0} HP · dies at −{-derived.deathThreshold}</span>
          {!unconscious && canEdit && (
            <>
              <Button
                size="compact"
                variant="line-primary"
                className="px-3"
                onClick={() => void dispatch({ kind: 'condition:set', conditionId: CONDITION.unconscious, level: null, permanent: false })}
              >
                Go unconscious
              </Button>
              <span className="text-meta text-muted-foreground">or in 10 minutes</span>
            </>
          )}
        </div>
      )}
      {/* Heart die and rush */}
      <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Heart die</span>
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="compact" variant="line" className="px-2.5" aria-label={`Heart die d${hp.heartDieCurrent}. Set it by hand`}>
                  <span className="font-hand text-[17px] font-normal">d<Written value={hp.heartDieCurrent} /></span> <span aria-hidden="true">▾</span>
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
            <span className="font-hand text-[19px]">d<Written value={hp.heartDieCurrent} /></span>
          )}
          {canEdit && (
            <Button
              size="compact"
              variant="line"
              className="px-3"
              disabled={spendBlocked !== null}
              aria-expanded={spending && spendBlocked === null}
              onClick={() => setSpending((o) => !o)}
            >
              Spend <span aria-hidden="true">{spending && spendBlocked === null ? '▴' : '▾'}</span>
            </Button>
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

      {canEdit && spending && spendBlocked === null && (
        <div className="reveal">
          <div>
            <ul aria-label="Drop the heart die one size to…" className="-mt-1 ml-0.5 flex flex-col border-l-[1.5px] border-primary">
              {SPEND.map((s) => (
                <li key={s.effect}>
                  <button
                    type="button"
                    className="group flex min-h-11 w-full items-baseline gap-2.5 px-3 py-2.5 text-left"
                    onClick={() => (setSpending(false), void dispatch({ kind: 'heartDie:spend', effect: s.effect }))}
                  >
                    <span className="min-w-14 font-semibold group-hover:text-primary">{s.label}</span>
                    <span className="text-meta text-muted-foreground">{s.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Round */}
      <div className="flex min-h-11 flex-wrap items-center gap-2">
        <span className="mr-1">
          <span className="eyebrow mr-2">Round</span>
          <span className="inline-block min-w-[22px] text-center font-hand text-[20px]"><Written value={play.round} /></span>
        </span>
        {canEdit && (
          <>
            <Button size="compact" variant="line-primary" onClick={nextRound}>
              Next round
            </Button>
            <Button size="compact" variant="line" onClick={() => void dispatch({ kind: 'endFight' })}>
              End fight
            </Button>
          </>
        )}
      </div>

      {/* DP */}
      <div className="flex min-h-11 flex-wrap items-center gap-2">
        <Stepper label="DP" value={play.dp} canEdit={canEdit} min={0} max={10} onChange={(value) => void dispatch({ kind: 'dp:set', value })} />
        {canEdit && (
          <Button size="compact" variant="line" className="px-3" onClick={() => void dispatch({ kind: 'startSession' })}>
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
              className="h-11 w-24 text-center [--field-size:22px]"
            />
            {burnAmount >= WOUND_AT && (
              <label className="flex flex-col gap-1 text-ui">
                Wound of rank {burnAmount} — describe it
                <Input
                  placeholder="e.g. burned arm"
                  value={burning?.description ?? ''}
                  onChange={(e) => setBurning((b) => (b ? { ...b, description: e.target.value } : b))}
                  className="h-11"
                />
              </label>
            )}
            <DialogFooter>
              <Button size="compact" type="button" variant="ghost" onClick={skipBurn}>
                Skip
              </Button>
              <Button size="compact" variant="line-primary" type="submit" disabled={burnAmount < 1}>
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
        <Button size="compact-icon" variant="line" aria-label={`${label} one less`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </Button>
      )}
      <span className="min-w-[22px] text-center font-hand text-[20px]" aria-label={`${label} ${value}`}>
        <Written value={value} />
      </span>
      {canEdit && (
        <Button size="compact-icon"
          variant="line"
         
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
