// The result of one roll (campaign spec §3.1, ruling 24): the dice with dropped dice struck through, the total, the spec's
// result line, and the complication state. A pending complication offers **Fail** and **Reroll and take a complication**:
// for a campaign roll the server completes the stored row (`resolveComplicationFn`); for a character in no campaign
// nothing is stored, so the server draws one die (`rerollDieFn`) and the engine's `rerollComplication` puts it in place.
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { formatRoll, rerollComplication, type RolledDie } from '@heartrush/rules-engine/dice'
import { Button } from '@heartrush/ui/components/button'
import { cn } from '@heartrush/ui/lib/utils'
import { rerollDieFn, resolveComplicationFn, type RollView } from '~/server/rolls'

/** One roll as the sheet keeps it until the next roll. `rollId` is the stored row's id; null for a character in no campaign. */
export type RollOutcome = {
  characterId: string
  rollId: string | null
  view: RollView
  /** Set for a stratagem objective roll: the result is compared with the objective's CN. */
  objective?: { label: string; cn: number }
}

/** The text shown when a request to the roll server fails before it answers. */
export const ROLL_NO_CONNECTION = 'Not rolled — no connection'

const isKeptOne = (d: RolledDie) => !d.dropped && d.value === 1

/**
 * Shows `outcome` and, on a pending complication, the two choices. `onChange` receives the completed roll. `compact` is the
 * line under an ability row: the same content in a smaller block.
 */
export function RollResultView({ outcome, onChange, compact = false }: { outcome: RollOutcome; onChange: (next: RollOutcome) => void; compact?: boolean }) {
  const { view, objective } = outcome
  const resolve = useServerFn(resolveComplicationFn)
  const reroll = useServerFn(rerollDieFn)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choose = async (choice: 'fail' | 'reroll') => {
    setBusy(true)
    setError(null)
    try {
      if (outcome.rollId !== null) {
        const r = await resolve({ data: { rollId: outcome.rollId, choice } })
        if (!r.ok) return setError(r.message)
        onChange({ ...outcome, view: { ...view, dice: r.roll.dice, total: r.roll.total, complication: r.roll.complication } })
      } else if (choice === 'fail') {
        onChange({ ...outcome, view: { ...view, complication: 'failed' } })
      } else {
        const one = view.dice.find(isKeptOne)
        if (!one) return setError('There is no kept 1 to reroll')
        const r = await reroll({ data: { characterId: outcome.characterId, sides: one.sides } })
        if (!r.ok) return setError(r.message)
        const next = rerollComplication({ ...view, complication: 'pending' }, () => r.value)
        onChange({ ...outcome, view: next })
      }
    } catch {
      setError(ROLL_NO_CONNECTION)
    } finally {
      setBusy(false)
    }
  }

  // The result line does not depend on the complication; the engine's type has no `double`, which is shown separately below.
  const line = formatRoll({ ...view, complication: 'none' })
  const failed = view.complication === 'failed' || view.complication === 'double'

  return (
    <div className={cn('flex flex-col', compact ? 'gap-1.5 py-2' : 'gap-3')} aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={cn('font-sans font-semibold tabular-nums', compact ? 'text-h4' : 'text-h3')} aria-label={`Total ${view.total}`}>
          {view.total}
        </span>
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Dice">
          {view.dice.map((d, i) => (
            <li key={i}>
              <DieChip die={d} />
            </li>
          ))}
          {view.flat !== 0 && <li className="text-ui text-muted-foreground tabular-nums">{signed(view.flat)}</li>}
          {view.modifier !== 0 && <li className="text-ui text-muted-foreground tabular-nums">{signed(view.modifier)}</li>}
        </ul>
      </div>
      <p className="text-meta text-muted-foreground tabular-nums">{line}</p>

      {view.complication === 'pending' && (
        <div className="flex flex-col gap-2">
          <p className="text-ui font-medium">A kept die shows 1. Fail, or reroll that die and take a complication.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" disabled={busy} onClick={() => void choose('fail')}>
              Fail
            </Button>
            <Button type="button" className="h-11 flex-1" disabled={busy} onClick={() => void choose('reroll')}>
              Reroll and take a complication
            </Button>
          </div>
        </div>
      )}
      {view.complication === 'double' && <p className="text-ui font-semibold text-primary">Automatic failure plus a complication (two kept 1s)</p>}
      {view.complication === 'failed' && <p className="text-ui font-semibold text-primary">Failed (chose to fail on the 1)</p>}
      {view.complication === 'rerolled' && <p className="text-ui font-semibold">Rerolled the 1 — take a complication</p>}
      {objective && !failed && view.complication !== 'pending' && (
        <p className="text-ui font-semibold">
          {view.total >= objective.cn ? `meets CN ${objective.cn}` : `below CN ${objective.cn}`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-ui text-primary">
          {error}
        </p>
      )}
    </div>
  )
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)

/** One die: its type and value; a dropped die is struck through; a rerolled die shows "1 → new". */
function DieChip({ die }: { die: RolledDie }) {
  const name = `${die.role === 'heart' ? 'heart ' : ''}d${die.sides}`
  const value = die.rerolled !== undefined ? `1 → ${die.value}` : String(die.value)
  const label = `${name} ${value}${die.dropped ? ', dropped' : ''}${die.rerolled !== undefined ? ', rerolled' : ''}`
  return (
    <span
      aria-label={label}
      className={cn(
        'dice inline-flex min-h-7 items-center gap-1 rounded-sm border px-1.5 text-ui',
        die.dropped ? 'border-border text-muted-foreground line-through' : 'border-input',
        die.role === 'heart' && !die.dropped && 'border-primary',
      )}
    >
      <span className="text-muted-foreground">{name}</span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}
