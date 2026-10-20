import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

/** Stub: S2 replaces this file with the Wounds section (add, edit, Treat, remove). Until then it lists the wounds read-only. */
export function WoundsSection({ character, derived }: SectionProps) {
  const heading = derived.woundPenalty > 0 ? `Wounds (−${derived.woundPenalty} max HP)` : 'Wounds'
  return (
    <Section title={heading}>
      {character.wounds.length === 0 ? (
        <p className="text-ui text-muted-foreground">No wounds.</p>
      ) : (
        <ul className="flex flex-col">
          {character.wounds.map((w) => (
            <li key={w.id} className="flex min-h-11 items-center gap-3 border-b border-border last:border-b-0">
              <span className="w-8 shrink-0 font-sans text-control font-semibold tabular-nums text-wound">{w.rank}</span>
              <span className="min-w-0 flex-1 truncate text-ui">{w.description || <span className="text-muted-foreground">No description</span>}</span>
              {w.treated && <span className="shrink-0 text-meta text-muted-foreground">treated</span>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
