import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

/** Stub: S3 replaces this file with the Notes section. The sheet already places it. */
export function NotesSection(_props: SectionProps) {
  return (
    <Section title="Notes">
      <p className="text-ui text-muted-foreground">Coming soon.</p>
    </Section>
  )
}
