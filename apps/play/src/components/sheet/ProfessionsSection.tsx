import { ProfessionRow } from '~/components/professions/ProfessionRow'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

/**
 * The sheet's professions (spec §5): one progress row per profession. Adding, renaming, correcting the rank and
 * removing a profession live on `/characters/$id/edit`; this section changes only the progress counters and the rank
 * through Advance.
 */
export function ProfessionsSection({ character, dispatch, canEdit }: SectionProps) {
  return (
    <Section title="Professions">
      {character.professions.length === 0 ? (
        <p className="text-ui text-muted-foreground">No professions.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {character.professions.map((profession) => (
            <ProfessionRow key={profession.id} character={character} profession={profession} dispatch={dispatch} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </Section>
  )
}
