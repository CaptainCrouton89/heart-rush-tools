// The result of one roll (campaign spec §3.1, ruling 24): the dice with dropped dice struck through, the total, the spec's
// result line, and the complication state. A pending complication offers **Fail** and **Reroll and take a complication**:
// for a campaign roll the server completes the stored row (`resolveComplicationFn`); for a character in no campaign
// nothing is stored, so the server draws one die (`rerollDieFn`) and the engine's `rerollComplication` puts it in place.
//
// **Focus** (`Combat.md` Spending Stamina) sets one kept die to its maximum and drops the heart die one size: the server
// spends the die and, for a stored roll, focuses the stored die in the same batch (`focusRollFn`); with nothing stored the
// engine's `focusDie` updates the result here. **Reroll 1s** (Wisdom of Experience, a skill check with that profession's
// modifier) rerolls every kept 1 with no complication: `rerollOnesRollFn` for a stored roll, `rerollDieFn` per die otherwise.
import { useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { CONDITION, hasCondition } from '@heartrush/rules-engine/conditions'
import { focusDie, formatRoll, onesToReroll, rerollComplication, rerollOnes, type RolledDie, type RollResult } from '@heartrush/rules-engine/dice'
import type { Character } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { cn } from '@heartrush/ui/lib/utils'
import { focusRollFn, rerollDieFn, rerollOnesRollFn, resolveComplicationFn, type RollView } from '~/server/rolls'

/** One roll as the sheet keeps it until the next roll. `rollId` is the stored row's id; null for a character in no campaign. */
export type RollOutcome = {
  characterId: string
  rollId: string | null
  view: RollView
  /** Set for a stratagem objective roll: the result is compared with the objective's CN. */
  objective?: { label: string; cn: number }
  /** The modifier was a Wisdom of Experience profession's rank: a skill check may reroll its kept 1s once. */
  wisdom?: boolean
}

/** The text shown when a request to the roll server fails before it answers. */
export const ROLL_NO_CONNECTION = 'Not rolled — no connection'

const isKeptOne = (d: RolledDie) => !d.dropped && d.value === 1

/** The engine's result for a view (storage's `double` is the engine's `failed` with `automaticFailure`). */
const engineResult = (view: RollView): RollResult => ({
  ...view, complication: view.complication === 'double' ? 'failed' : view.complication, automaticFailure: view.complication === 'double',
})
const storedView = (r: RollResult): RollView => ({ ...r, complication: r.automaticFailure ? 'double' : r.complication })

/**
 * Why Focus is not offered on this character now, or null when it is: stamina is spent once per round, not below d4 and
 * not while Suffocating (`heartDie:spend`'s refusals).
 */
const HEART_STEPS = [4, 6, 8, 10, 12, 20] as const
const smallerHeartDie = (sides: number) => HEART_STEPS[HEART_STEPS.indexOf(sides as (typeof HEART_STEPS)[number]) - 1]

function focusBlocked(c: Character): string | null {
  if (c.play.staminaSpentRound === c.play.round) return 'spent'
  if (c.hp.heartDieCurrent === 4) return 'floor'
  if (hasCondition(c, CONDITION.suffocating)) return 'suffocating'
  return null
}

/**
 * Shows `outcome` and, on a pending complication, the two choices; then **Focus** and **Reroll 1s** when they apply.
 * `character` is the roller's current sheet (Focus depends on its heart die and round). `onChange` receives the changed
 * roll. `compact` is the line under an ability row: the same content in a smaller block.
 */
export function RollResultView({
  outcome, character, onChange, compact = false,
}: { outcome: RollOutcome; character: Character; onChange: (next: RollOutcome) => void; compact?: boolean }) {
  const { view, objective } = outcome
  const router = useRouter()
  const resolve = useServerFn(resolveComplicationFn)
  const reroll = useServerFn(rerollDieFn)
  const focus = useServerFn(focusRollFn)
  const rerollOnesFn = useServerFn(rerollOnesRollFn)
  const [busy, setBusy] = useState(false)
  // The outcome on screen now. A Focus, reroll or complication response is applied only to the outcome it was asked for:
  // a new roll made while it was in flight replaces that outcome, and the late response must not replace the new roll.
  const shown = useRef(outcome)
  shown.current = outcome
  const apply = (next: RollOutcome) => {
    if (shown.current === outcome) onChange(next)
  }
  const [error, setError] = useState<string | null>(null)
  // Picking the die Focus sets to its maximum.
  const [picking, setPicking] = useState(false)

  const run = async (work: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    try {
      const refusal = await work()
      if (refusal) setError(refusal)
    } catch {
      setError(ROLL_NO_CONNECTION)
    } finally {
      setBusy(false)
    }
  }

  const focusOn = (index: number) =>
    run(async () => {
      setPicking(false)
      const r = await focus({ data: { characterId: outcome.characterId, rollId: outcome.rollId, dieIndex: index } })
      if (!r.ok) return r.message
      // The heart die was spent: the page's loader adopts the new revision.
      void router.invalidate()
      const next = r.roll ? { ...view, dice: r.roll.dice, total: r.roll.total, complication: r.roll.complication } : storedView(focusDie(engineResult(view), index))
      apply({ ...outcome, view: next })
      return null
    })

  const rerollTheOnes = () =>
    run(async () => {
      if (outcome.rollId !== null) {
        const r = await rerollOnesFn({ data: { rollId: outcome.rollId } })
        if (!r.ok) return r.message
        apply({ ...outcome, view: { ...view, dice: r.roll.dice, total: r.roll.total, complication: r.roll.complication } })
        return null
      }
      const values: number[] = []
      for (const i of onesToReroll(view)) {
        const r = await reroll({ data: { characterId: outcome.characterId, sides: view.dice[i]!.sides } })
        if (!r.ok) return r.message
        values.push(r.value)
      }
      apply({ ...outcome, view: storedView(rerollOnes(engineResult(view), () => values.shift()!)) })
      return null
    })

  const choose = async (choice: 'fail' | 'reroll') => {
    setBusy(true)
    setError(null)
    try {
      if (outcome.rollId !== null) {
        const r = await resolve({ data: { rollId: outcome.rollId, choice } })
        if (!r.ok) return setError(r.message)
        apply({ ...outcome, view: { ...view, dice: r.roll.dice, total: r.roll.total, complication: r.roll.complication } })
      } else if (choice === 'fail') {
        apply({ ...outcome, view: { ...view, complication: 'failed' } })
      } else {
        const one = view.dice.find(isKeptOne)
        if (!one) return setError('There is no kept 1 to reroll')
        const r = await reroll({ data: { characterId: outcome.characterId, sides: one.sides } })
        if (!r.ok) return setError(r.message)
        const next = rerollComplication({ ...view, complication: 'pending' }, () => r.value)
        apply({ ...outcome, view: next })
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
  const pending = view.complication === 'pending'
  const focusedDie = view.dice.find((d) => d.focused !== undefined)
  const canFocus = !pending && !focusedDie && focusBlocked(character) === null
  // A chosen Fail or a complication reroll settled the 1 already; two kept 1s (double) have not been settled.
  const canRerollOnes = outcome.wisdom === true && onesToReroll(view).length > 0 && view.complication !== 'failed' && view.complication !== 'rerolled'

  return (
    <div className={cn('flex flex-col', compact ? 'gap-1.5 py-2' : 'gap-3')} aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={cn('font-sans font-semibold tabular-nums', compact ? 'text-h4' : 'text-h3')} aria-label={`Total ${view.total}`}>
          {view.total}
        </span>
        <ul className="flex flex-wrap items-center gap-1.5" aria-label={picking ? 'Pick the die to set to its maximum' : 'Dice'}>
          {view.dice.map((d, i) => (
            <li key={i}>
              {picking && !d.dropped ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm hover:bg-surface-muted"
                  aria-label={`Focus the d${d.sides}${d.role === 'heart' ? ' heart die' : ''} showing ${d.value}: set it to ${d.sides}`}
                  disabled={busy}
                  onClick={() => void focusOn(i)}
                >
                  <DieChip die={d} picking />
                </button>
              ) : (
                <DieChip die={d} />
              )}
            </li>
          ))}
          {view.flat !== 0 && <li className="text-ui text-muted-foreground tabular-nums">{signed(view.flat)}</li>}
          {view.modifier !== 0 && <li className="text-ui text-muted-foreground tabular-nums">{signed(view.modifier)}</li>}
        </ul>
      </div>
      <p className="text-meta text-muted-foreground tabular-nums">{line}</p>

      {pending && (
        <div className="flex flex-col gap-2">
          <p className="text-ui font-medium">
            A kept die shows 1. Fail, or reroll that die and take a complication{canRerollOnes ? ' — or reroll the 1s with Wisdom of Experience' : ''}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="compact" type="button" variant="line" className="flex-1" disabled={busy} onClick={() => void choose('fail')}>
              Fail
            </Button>
            <Button size="compact" variant="line-primary" type="button" className="flex-1" disabled={busy} onClick={() => void choose('reroll')}>
              Reroll and take a complication
            </Button>
          </div>
        </div>
      )}
      {(canRerollOnes || canFocus) && !picking && (
        <div className="flex flex-wrap gap-2">
          {canRerollOnes && (
            <Button size="compact" variant="line-primary" type="button" className="px-3" disabled={busy} onClick={() => void rerollTheOnes()}>
              Reroll 1s <span className="font-normal text-muted-foreground">· Wisdom of Experience, no complication</span>
            </Button>
          )}
          {canFocus && (
            <Button size="compact" variant="line" type="button" className="px-3" disabled={busy} onClick={() => setPicking(true)}>
              Focus <span className="font-normal text-muted-foreground">· one die to its maximum, heart die d{character.hp.heartDieCurrent} → d{smallerHeartDie(character.hp.heartDieCurrent)}</span>
            </Button>
          )}
        </div>
      )}
      {picking && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-ui font-medium">Tap the die to set to its maximum. The heart die drops one size.</p>
          <Button size="compact" variant="ghost" type="button" onClick={() => setPicking(false)}>
            Cancel
          </Button>
        </div>
      )}
      {focusedDie && <p className="text-ui font-semibold">Focused: d{focusedDie.sides} {focusedDie.focused} → {focusedDie.value}</p>}
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

/**
 * One die: its type and value; a dropped die is struck through; a rerolled die shows "1 → new"; a focused die shows
 * "old → max". `picking`: the die is a Focus target (the button around it carries the label).
 */
export function DieChip({ die, picking = false }: { die: RolledDie; picking?: boolean }) {
  const name = `${die.role === 'heart' ? 'heart ' : ''}d${die.sides}`
  const from = die.focused ?? (die.rerolled !== undefined ? 1 : null)
  const value = from !== null ? `${from} → ${die.value}` : String(die.value)
  const label = `${name} ${value}${die.dropped ? ', dropped' : ''}${die.rerolled !== undefined ? ', rerolled' : ''}${die.focused !== undefined ? ', focused' : ''}`
  return (
    <span
      aria-label={picking ? undefined : label}
      aria-hidden={picking || undefined}
      className={cn(
        'dice inline-flex min-h-7 items-center gap-1 rounded-sm border px-1.5 text-ui',
        die.dropped ? 'border-border text-muted-foreground line-through' : 'border-input',
        die.role === 'heart' && !die.dropped && 'border-primary',
        picking && 'border-dashed border-primary',
      )}
    >
      <span className="text-muted-foreground">{name}</span>
      <span className="font-semibold">{value}</span>
    </span>
  )
}
