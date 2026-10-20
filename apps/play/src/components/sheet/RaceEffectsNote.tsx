import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

/**
 * Reminders for racial rules the app does not apply itself: one line per `manual` race effect (for example a
 * Ghoul's oath-talent discount). Effects the engine applies — prices, caps, award bonuses, attunements — need no
 * reminder. A character whose race has no effects says so, because an unmapped race also has an empty list.
 */
export function RaceEffectsNote({ character }: SectionProps) {
  const effects = character.raceEffects
  const manual = effects.flatMap((e) => (e.kind === 'manual' ? [e.text] : []))
  if (effects.length > 0 && manual.length === 0) return null
  return (
    <Section title="Racial effects">
      {effects.length === 0 ? (
        <p className="text-ui text-muted-foreground">No racial effects.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {manual.map((text, n) => (
            <li key={n} role="note" className="text-ui">
              {text}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
