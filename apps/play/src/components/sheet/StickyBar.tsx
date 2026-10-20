import type { Character } from '@heartrush/rules-engine/types'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@heartrush/ui/components/dropdown-menu'
import type { Derived } from '~/server/characters'

/** A page the sheet's header links to: Advance, Edit, Campaign (design, "Sheet, desktop"). */
export type SheetLink = { label: string; href: string }

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
 * who cannot edit, so there is no pad) HP is plain text. `links` are the header's page links: from 1024 px they sit at
 * the bar's right end ("Advance · Edit · Campaign"); below that the name is a menu button ("Kaelen ▾") that lists them.
 */
export function StickyBar({ character, derived, onHp, links = [] }: { character: Character; derived: Derived; onHp?: () => void; links?: SheetLink[] }) {
  const { current } = character.hp
  const name = character.identity.name || 'Unnamed character'
  const nameClass = 'min-w-0 truncate font-serif text-h4 font-semibold'
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
        <span className="flex min-w-0 flex-1">
          {links.length === 0 ? (
            <span className={nameClass}>{name}</span>
          ) : (
            <>
              <span className={`hidden lg:inline ${nameClass}`}>{name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`${name}: pages`}
                  className="-ml-2 inline-flex min-h-11 min-w-0 items-center gap-1 rounded-md px-2 hover:bg-surface-muted lg:hidden"
                >
                  <span className={nameClass}>{name}</span>
                  <span aria-hidden="true" className="shrink-0 text-ui text-muted-foreground">▾</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {links.map((l) => (
                    <DropdownMenuItem key={l.href} asChild className="min-h-11">
                      <a href={l.href}>{l.label}</a>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </span>
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
        {links.length > 0 && (
          <nav aria-label="Character pages" className="ml-2 hidden shrink-0 items-center border-l border-border pl-2 lg:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="inline-flex min-h-11 items-center px-2 text-ui font-medium text-primary underline-offset-4 hover:underline">
                {l.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
