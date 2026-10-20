import { cn } from '@heartrush/ui/lib/utils'
import { useEffect, useState } from 'react'
import { UNDO_CHIP_MS } from '~/components/sheet/UndoChip'

/**
 * Tracks one value across renders: `n` counts the changes since mount and `prev` is the value before the latest one.
 * The first render (including hydration) is not a change, so nothing animates when a page loads. Derived state set
 * during render, the pattern React documents for "information from previous renders".
 */
export function useChange<T>(value: T): { n: number; prev: T | undefined } {
  const [s, setS] = useState<{ value: T; n: number; prev: T | undefined }>({ value, n: 0, prev: undefined })
  if (!Object.is(s.value, value)) {
    const next = { value, n: s.n + 1, prev: s.value }
    setS(next)
    return next
  }
  return s
}

/**
 * A number the player changes, in Kalam. When it changes it is written in left to right and arrives in ember with a
 * glow that settles to its own colour (play design, Motion). `goodWhen` makes the colour follow the direction: a
 * change the right way arrives green (`good`), the wrong way ember (`bad`) — HP and max HP use `higher`. `strike`
 * also shows the old value with a line drawn through it, faded out once the Undo window (8 s) has passed.
 */
export function Written({
  value,
  className,
  goodWhen,
  strike = false,
}: {
  value: number | string
  className?: string
  goodWhen?: 'higher' | 'lower'
  strike?: boolean
}) {
  const { n, prev } = useChange(value)
  let tone: 'good' | 'bad' | null = null
  if (n > 0 && goodWhen && typeof value === 'number' && typeof prev === 'number') {
    tone = (value > prev) === (goodWhen === 'higher') ? 'good' : 'bad'
  }
  return (
    <>
      {strike && n > 0 && prev !== undefined && <Struck key={`was-${n}`} value={prev} good={tone === 'good'} />}
      <span key={n} className={cn('written', n > 0 && 'fresh', tone, className)}>
        {value}
      </span>
    </>
  )
}

/** The old value, struck through with a pen line; it fades after the Undo window and is then removed. */
function Struck({ value, good }: { value: number | string; good: boolean }) {
  const [phase, setPhase] = useState<'shown' | 'fading' | 'gone'>('shown')
  useEffect(() => {
    const fade = setTimeout(() => setPhase('fading'), UNDO_CHIP_MS)
    const gone = setTimeout(() => setPhase('gone'), UNDO_CHIP_MS + 1200)
    return () => (clearTimeout(fade), clearTimeout(gone))
  }, [])
  if (phase === 'gone') return null
  return (
    <s aria-hidden="true" className={cn('struck', good && 'good', phase === 'fading' && 'fading')}>
      <span>{value}</span>
      <svg viewBox="0 0 40 10" preserveAspectRatio="none">
        <path pathLength={100} d="M1 7.5 C 12 5.5, 26 4.5, 39 2.5" />
      </svg>
    </s>
  )
}

/** How long an arrival stays marked: longer than every entry animation (the slowest, a long wound description, ends by 3.5 s). */
const ARRIVAL_MS = 4000

/**
 * The ids that appeared after the first render. Each stays marked for `ARRIVAL_MS` from the latest arrival, so a
 * re-render (the server's saved copy replacing the optimistic one) does not cut its entry animation short, and is then
 * cleared so later changes animate as changes and a remount does not replay the entry.
 */
export function useArrivals(ids: readonly string[]): ReadonlySet<string> {
  const [s, setS] = useState(() => ({ seen: new Set(ids), fresh: new Set<string>() }))
  const unseen = ids.filter((id) => !s.seen.has(id))
  const state = unseen.length === 0 ? s : { seen: new Set([...s.seen, ...unseen]), fresh: new Set([...s.fresh, ...unseen]) }
  if (state !== s) setS(state)
  useEffect(() => {
    if (s.fresh.size === 0) return
    const t = setTimeout(() => setS((x) => ({ ...x, fresh: new Set<string>() })), ARRIVAL_MS)
    return () => clearTimeout(t)
  }, [s.fresh])
  return state.fresh
}

/**
 * For a row of marks showing `done` filled: which marks the latest change filled (`fresh`, filled one after another
 * from the lowest) or emptied (`fading`, emptied from the highest), with each one's delay. Nothing before the first
 * change.
 */
export function useMarkChange(done: number): (i: number) => { fresh: boolean; fading: boolean; delay: number } {
  const { n, prev } = useChange(done)
  return (i) => {
    if (n === 0 || prev === undefined) return { fresh: false, fading: false, delay: 0 }
    if (done > prev && i >= prev && i < done) return { fresh: true, fading: false, delay: (i - prev) * 110 }
    if (done < prev && i >= done && i < prev) return { fresh: false, fading: true, delay: (prev - 1 - i) * 90 }
    return { fresh: false, fading: false, delay: 0 }
  }
}
