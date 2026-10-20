import type { Character } from '@heartrush/rules-engine/types'
import type { Derived } from '~/server/characters'

/**
 * The HP colour rule (design, Visual identity): above half the effective max → `hp` (green); from a quarter to a half
 * → `warning`; below a quarter, or at 0 or less → `primary` (red).
 */
export function hpColorClass(current: number, effectiveMax: number): string {
  if (current <= 0 || current < effectiveMax / 4) return 'text-primary'
  if (current <= effectiveMax / 2) return 'text-warning'
  return 'text-hp'
}

/**
 * Sticky under the site header at every scroll position (criterion 20): name, current heart die and HP
 * `current / effective max`. Tapping HP moves to the damage pad and focuses its amount field; without `onHp` (a viewer
 * who cannot edit, so there is no pad) HP is plain text.
 */
export function StickyBar({ character, derived, onHp }: { character: Character; derived: Derived; onHp?: () => void }) {
  const { current } = character.hp
  const hp = (
    <>
      <span className={`text-h4 font-semibold ${hpColorClass(current, derived.effectiveMaxHp)}`}>{current}</span>
      <span className="text-control text-muted-foreground">/ {derived.effectiveMaxHp}</span>
      <span className="text-meta text-muted-foreground">HP</span>
    </>
  )
  return (
    <div className="sticky top-14 z-20 border-b border-border bg-surface/95 backdrop-blur md:top-16">
      <div className="mx-auto flex min-h-12 w-full max-w-6xl items-center gap-3 px-5 md:px-8">
        <span className="min-w-0 flex-1 truncate font-serif text-h4 font-semibold">{character.identity.name || 'Unnamed character'}</span>
        <span className="shrink-0 font-sans text-control font-semibold tabular-nums" aria-label={`Heart die d${character.hp.heartDieCurrent}`}>
          d{character.hp.heartDieCurrent} <span aria-hidden="true" className="text-primary">♥</span>
        </span>
        {onHp ? (
          <button
            type="button"
            onClick={onHp}
            aria-label={`HP ${current} of ${derived.effectiveMaxHp}. Open the damage pad`}
            className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2 font-sans tabular-nums hover:bg-surface-muted"
          >
            {hp}
          </button>
        ) : (
          <span aria-label={`HP ${current} of ${derived.effectiveMaxHp}`} className="inline-flex shrink-0 items-center gap-1.5 font-sans tabular-nums">
            {hp}
          </span>
        )}
      </div>
    </div>
  )
}
