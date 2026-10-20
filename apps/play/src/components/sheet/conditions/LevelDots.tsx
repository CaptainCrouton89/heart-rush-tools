import type { CSSProperties } from 'react'
import { useMarkChange } from '~/components/motion'

/**
 * Five level dots, drawn as inked marks: new levels fill one after another from the lowest, removed ones empty from
 * the highest. Tapping dot n sets the level to n; the dots below `floor` are filled by levels this control cannot
 * change (sleep-sourced levels, which only a successful long rest removes) and are not buttons. Each dot is a 44 px
 * target. Without `onSet` the dots only show the level.
 */
export function LevelDots({ name, level, floor = 0, onSet }: { name: string; level: number; floor?: number; onSet?: (level: number) => void }) {
  const markChange = useMarkChange(level)
  return (
    <span role="group" aria-label={`${name} level ${level} of 5`} className="inline-flex shrink-0 items-center">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= level
        const change = markChange(n - 1)
        const dot = (
          <span
            aria-hidden="true"
            style={change.delay ? ({ '--d': `${change.delay}ms` } as CSSProperties) : undefined}
            className={`ink-mark${filled ? ' on' : ''}${change.fresh ? ' fresh' : ''}${change.fading ? ' fade' : ''}${n <= floor ? ' opacity-60' : ''}`}
          >
            <svg viewBox="0 0 16 16" width={15} height={15}>
              <circle className="ol" cx={8} cy={8} r={5.6} />
              <circle className="fl" cx={8} cy={8} r={3.4} />
            </svg>
          </span>
        )
        if (!onSet || n <= floor) {
          return (
            <span key={n} className={onSet ? 'inline-flex h-8 w-11 items-center justify-center' : 'inline-flex size-5 items-center justify-center'}>
              {dot}
            </span>
          )
        }
        return (
          <button
            key={n}
            type="button"
            aria-label={`Set ${name} to level ${n}`}
            aria-pressed={filled}
            onClick={() => onSet(n)}
            className="relative inline-flex h-8 w-11 items-center justify-center rounded-sm after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:bg-surface-muted"
          >
            {dot}
          </button>
        )
      })}
    </span>
  )
}
