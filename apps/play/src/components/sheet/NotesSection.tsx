import { EditLink } from '~/components/edit/EditLink'
import { JournalMarkdown } from '~/components/journal/JournalMarkdown'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

/** The character's notes (markdown), read-only; they are written on `/characters/$id/edit`. */
export function NotesSection({ character, canEdit }: SectionProps) {
  return (
    <Section
      title="Notes"
      action={canEdit && <EditLink block="notes" />}
    >
      {character.notes.trim() ? <JournalMarkdown source={character.notes} /> : <p className="text-ui text-muted-foreground">No notes.</p>}
    </Section>
  )
}
