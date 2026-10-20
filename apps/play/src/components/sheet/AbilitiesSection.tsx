import { useState } from 'react'
import type { Frequency } from '@heartrush/rules-engine/catalogue'
import { ToggleGroup, ToggleGroupItem } from '@heartrush/ui/components/toggle-group'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'
import { AbilityRow } from './abilities/AbilityRow'
import { ExplainButtonForRoute } from '~/components/ai/ExplainButton'

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'passive', label: 'Passive' },
]

/**
 * The character's abilities (every row of `talents`: catalogue talents, racial abilities, bloodmark and custom ones),
 * grouped by frequency. Below 1024 px a segmented control shows one group at a time; from 1024 px every group shows
 * with its rules text expanded (design, desktop middle column). The segment starts on the first group that has rows.
 */
export function AbilitiesSection({ character, catalogue, dispatch, canEdit }: SectionProps) {
  const groups = FREQUENCIES.map((f) => ({ ...f, talents: character.talents.filter((t) => t.frequency === f.value) }))
  const [chosen, setChosen] = useState<Frequency | null>(null)
  const shown = chosen ?? groups.find((g) => g.talents.length > 0)?.value ?? 'minor'

  return (
    <Section title="Abilities">
      {character.talents.length === 0 ? (
        <p className="text-ui text-muted-foreground">No abilities.</p>
      ) : (
        <>
          <ToggleGroup
            type="single"
            value={shown}
            onValueChange={(v) => v && setChosen(v as Frequency)}
            aria-label="Ability frequency"
            className="w-full lg:hidden"
          >
            {groups.map((g) => (
              <ToggleGroupItem key={g.value} value={g.value} className="px-1 text-meta sm:px-3 sm:text-ui">
                {g.label}
                <span className="tabular-nums opacity-70">{g.talents.length}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {groups.map((g) => (
            <div key={g.value} className={g.value === shown ? 'flex flex-col' : 'hidden flex-col lg:flex'}>
              <h3 className="eyebrow hidden pt-2 lg:block">{g.label}</h3>
              {g.talents.length === 0 ? (
                <p className="py-2 text-ui text-muted-foreground lg:hidden">No {g.label.toLowerCase()} abilities.</p>
              ) : (
                <ul className="flex flex-col">
                  {g.talents.map((t) => (
                    <AbilityRow key={t.id} talent={t} rushPoints={character.play.rushPoints} catalogue={catalogue} dispatch={dispatch} canEdit={canEdit} extra={<ExplainButtonForRoute talentId={t.id} title={t.titleSnapshot} />} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}
    </Section>
  )
}
