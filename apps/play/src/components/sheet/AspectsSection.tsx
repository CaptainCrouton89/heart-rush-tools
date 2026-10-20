import type { Aspect } from '@heartrush/rules-engine/types'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

const SOURCE: Record<Aspect['source'], string> = { race: 'kin', age: 'age', created: 'created', purchased: 'bought', growth: 'growth' }

/** The age benefit Frail Body, Sharp Mind adds "Frail" (source age): it may only be invoked against the character. */
const isFrail = (a: Aspect) => a.source === 'age' && a.text === 'Frail'

/**
 * The character's aspects with rank and the honor tick (`aspect:edit`; honor is what a Neth Human's discount
 * applies to). Ranks and new aspects cost XP, so they change through Advance, not here.
 */
export function AspectsSection({ character, dispatch, canEdit }: SectionProps) {
  return (
    <Section title="Aspects">
      {character.aspects.length === 0 ? (
        <p className="text-ui text-muted-foreground">No aspects.</p>
      ) : (
        <ul className="flex flex-col">
          {character.aspects.map((a) => (
            <li key={a.id} className="flex min-h-11 items-center gap-3 border-b border-border py-1 last:border-b-0">
              <span className="w-6 shrink-0 text-center font-hand text-[19px]" aria-label={`Rank ${a.rank}`}>
                {a.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ui break-words">{a.text || <span className="text-muted-foreground">Unnamed aspect</span>}</p>
                <p className="text-meta text-muted-foreground">
                  {SOURCE[a.source]}
                  {isFrail(a) && ' · invoked negatively only'}
                </p>
              </div>
              {canEdit ? (
                <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 text-ui">
                  <input
                    type="checkbox"
                    checked={a.honor}
                    onChange={(e) => void dispatch({ kind: 'aspect:edit', aspect: { id: a.id, honor: e.target.checked } })}
                    className="size-5 accent-primary"
                  />
                  Honor
                </label>
              ) : (
                a.honor && <span className="shrink-0 text-meta font-medium">honor</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
