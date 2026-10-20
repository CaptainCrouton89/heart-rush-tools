/**
 * Five level dots. Tapping dot n sets the level to n; the dots below `floor` are filled by levels this control cannot
 * change (sleep-sourced levels, which only a successful long rest removes) and are not buttons. Each dot is a 44 px
 * target. Without `onSet` the dots only show the level.
 */
export function LevelDots({ name, level, floor = 0, onSet }: { name: string; level: number; floor?: number; onSet?: (level: number) => void }) {
  return (
    <span role="group" aria-label={`${name} level ${level} of 5`} className="inline-flex shrink-0 items-center">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= level
        const dot = (
          <span
            aria-hidden="true"
            className={`block size-3.5 rounded-full border-2 ${filled ? 'border-primary bg-primary' : 'border-muted-foreground'} ${n <= floor ? 'opacity-60' : ''}`}
          />
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
