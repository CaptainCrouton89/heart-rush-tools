import { useId } from 'react'
import type { BuilderInput } from '@heartrush/rules-engine/types'
import { Input } from '@heartrush/ui/components/input'
import { Textarea } from '@heartrush/ui/components/textarea'
import { Field } from './use-draft'

export type DreamFields = Pick<BuilderInput, 'name' | 'pronouns' | 'dream' | 'portrait'>

/**
 * Step 1 (Building_Your_Character.md "Your Dream"): name, pronouns, the dream and an optional portrait link. Controlled:
 * `/characters/new` holds these before the draft exists; the builder passes the draft's.
 */
export function StepDream({ value, onChange }: { value: DreamFields; onChange: (patch: Partial<DreamFields>) => void }) {
  const ids = useId()
  return (
    <div className="flex flex-col gap-6">
      <p className="font-serif text-body-sm text-muted-foreground">
        Build a character with a vision of what they want to achieve: a dream that is complex, difficult and worthy of the legend you want to
        become. You can change it later.
      </p>
      <Field label="Name" htmlFor={`${ids}-name`}>
        <Input id={`${ids}-name`} className="h-11" value={value.name} onChange={(e) => onChange({ name: e.target.value })} autoComplete="off" />
      </Field>
      <Field label="Pronouns" htmlFor={`${ids}-pronouns`} hint="Optional.">
        <Input id={`${ids}-pronouns`} className="h-11" value={value.pronouns} onChange={(e) => onChange({ pronouns: e.target.value })} autoComplete="off" />
      </Field>
      <Field label="Dream" htmlFor={`${ids}-dream`} hint="What do you want to be remembered for?">
        <Textarea id={`${ids}-dream`} rows={4} value={value.dream} onChange={(e) => onChange({ dream: e.target.value })} />
      </Field>
      <Field label="Portrait" htmlFor={`${ids}-portrait`} hint="Optional: a link to an image.">
        <Input
          id={`${ids}-portrait`}
          className="h-11"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={value.portrait ?? ''}
          onChange={(e) => onChange({ portrait: e.target.value.trim() ? e.target.value : null })}
        />
      </Field>
    </div>
  )
}
