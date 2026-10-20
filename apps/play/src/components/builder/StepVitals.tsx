import { useId } from 'react'
import { startingXp } from '@heartrush/rules-engine/bloodmarks'
import { maxHeartDie, maxHp, speed } from '@heartrush/rules-engine/derived'
import type { AbilityId } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { ToggleGroup, ToggleGroupItem } from '@heartrush/ui/components/toggle-group'
import { cn } from '@heartrush/ui/lib/utils'
import { Section } from '~/components/sheet/SheetLayout'
import { ABILITIES, AGE, Field, labelClass, sketchCharacter, type Age, type UseDraft } from './use-draft'

/**
 * Step 3 (Your Vitals, Your Age and Experience): the four ability tiles take d6, d6, d4, d4; the age category with its
 * benefit picks; the bloodmark level the table agreed on; and the HP, heart die, speed, DP and starting XP the engine
 * gives this character.
 */
export function StepVitals({ draft }: { draft: UseDraft }) {
  const ids = useId()
  const { builder, update } = draft
  const age = AGE[builder.ageCategory]
  const sixes = ABILITIES.filter((a) => builder.dice[a.id] === 6).length
  const fours = ABILITIES.filter((a) => builder.dice[a.id] === 4).length

  function setDie(ability: AbilityId, die: 4 | 6 | undefined) {
    update((b) => {
      const dice = { ...b.dice }
      if (die) dice[ability] = die
      else delete dice[ability]
      return { ...b, dice }
    })
  }
  function chooseAge(next: Age) {
    if (next === builder.ageCategory) return
    // The benefits belong to the old age; professions stay and step 4 says if their ranks no longer fit.
    update((b) => {
      const { deepKnowledgeAspect: _d, ageBenefitProfession: _w, ...rest } = b
      return { ...rest, ageCategory: next, ageBenefits: [] }
    })
  }
  function toggleBenefit(id: string) {
    update((b) => {
      const benefits = age.picks === 1 ? [id] : b.ageBenefits.includes(id) ? b.ageBenefits.filter((x) => x !== id) : [...b.ageBenefits, id]
      const next = { ...b, ageBenefits: benefits }
      if (!benefits.includes('deep-knowledge')) delete next.deepKnowledgeAspect
      if (!benefits.includes('wisdom-of-experience')) delete next.ageBenefitProfession
      return next
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className={cn(labelClass, 'mb-1')}>Ability dice</legend>
        <p className="text-meta text-muted-foreground" aria-live="polite">
          Assign a d6 to two abilities and a d4 to the other two. Assigned: {sixes} of 2 d6, {fours} of 2 d4.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ABILITIES.map((a) => {
            const die = builder.dice[a.id]
            return (
              <div key={a.id} className={cn('flex items-center justify-between gap-3 rounded-md border p-3', die ? 'border-primary' : 'border-border')}>
                <span id={`${ids}-die-${a.id}`} className="text-control font-medium">
                  {a.label}
                </span>
                <ToggleGroup
                  type="single"
                  aria-labelledby={`${ids}-die-${a.id}`}
                  value={die ? `d${die}` : ''}
                  onValueChange={(v) => setDie(a.id, v === 'd6' ? 6 : v === 'd4' ? 4 : undefined)}
                >
                  <ToggleGroupItem value="d6" className="min-w-16" disabled={die !== 6 && sixes >= 2}>
                    d6
                  </ToggleGroupItem>
                  <ToggleGroupItem value="d4" className="min-w-16" disabled={die !== 4 && fours >= 2}>
                    d4
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={cn(labelClass, 'mb-1')}>Age</legend>
        <p className="text-meta text-muted-foreground">Optional; most characters are adults.</p>
        <ToggleGroup type="single" aria-label="Age" value={builder.ageCategory} onValueChange={(v) => v && chooseAge(v as Age)} className="w-full">
          {(Object.keys(AGE) as Age[]).map((a) => (
            <ToggleGroupItem key={a} value={a}>
              {AGE[a].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-ui text-muted-foreground">
          {age.ranks} profession ranks, at most {age.cap} in one profession.
          {builder.ageCategory === 'young' && ' Gain the aspect "Eager to Prove Myself".'}
          {builder.ageCategory === 'elderly' && ' Gain the aspect "Wisdom of Years". Your speed is 20 feet lower.'}
        </p>
        {age.picks > 0 && (
          <div className="flex flex-col gap-2">
            <p className={labelClass}>Choose {age.picks === 2 ? 'two' : 'one'} benefit{age.picks === 2 ? 's' : ''}</p>
            {age.benefits.map((b) => {
              const checked = builder.ageBenefits.includes(b.id)
              return (
                <label key={b.id} className="flex min-h-11 items-start gap-3 rounded-md border border-border p-3">
                  <input
                    type={age.picks === 1 ? 'radio' : 'checkbox'}
                    name={`${ids}-benefit`}
                    className="mt-0.5 size-5 shrink-0 accent-primary"
                    checked={checked}
                    disabled={age.picks === 2 && builder.ageBenefits.length >= 2 && !checked}
                    onChange={() => toggleBenefit(b.id)}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-control font-medium">{b.label}</span>
                    <span className="text-meta text-muted-foreground">{b.text}</span>
                  </span>
                </label>
              )
            })}
          </div>
        )}
        {builder.ageBenefits.includes('deep-knowledge') && (
          <Field label="Deep Knowledge aspect (rank 3)" htmlFor={`${ids}-deep`}>
            <Input
              id={`${ids}-deep`}
              className="h-11"
              placeholder="Knows Every Herb in the Forest"
              value={builder.deepKnowledgeAspect ?? ''}
              onChange={(e) => update({ deepKnowledgeAspect: e.target.value })}
            />
          </Field>
        )}
        {builder.ageBenefits.includes('wisdom-of-experience') && (
          <p className="text-meta text-muted-foreground">You choose the profession Wisdom of Experience applies to in the next step.</p>
        )}
      </fieldset>

      <BloodmarkLevel value={builder.bloodmarkLevel} onChange={(bloodmarkLevel) => update({ bloodmarkLevel })} />

      <Vitals draft={draft} />
    </div>
  )
}

function BloodmarkLevel({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const ids = useId()
  return (
    <div className="flex flex-col gap-2">
      <span id={`${ids}-label`} className={labelClass}>
        Bloodmarks
      </span>
      <p className="text-meta text-muted-foreground">The bloodmark level your table starts at; 0 unless your GM says otherwise.</p>
      <div role="group" aria-labelledby={`${ids}-label`} className="flex items-center gap-2">
        <Button size="compact-icon" type="button" variant="line" aria-label="One fewer bloodmark" disabled={value <= 0} onClick={() => onChange(value - 1)}>
          −
        </Button>
        <Input
          aria-labelledby={`${ids}-label`}
          className="h-11 w-20 text-center tabular-nums"
          inputMode="numeric"
          pattern="[0-9]*"
          value={String(value)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, '') || '0')
            onChange(Math.min(n, 20))
          }}
        />
        <Button size="compact-icon" type="button" variant="line" aria-label="One more bloodmark" disabled={value >= 20} onClick={() => onChange(value + 1)}>
          +
        </Button>
        <span className="text-ui text-muted-foreground">Starting XP {startingXp(value)}</span>
      </div>
    </div>
  )
}

/** The engine's numbers for this character (race base HP, age speed, race XP bonus), with placeholders for later steps. */
function Vitals({ draft }: { draft: UseDraft }) {
  const c = sketchCharacter(draft.builder)
  return (
    <Section title="Your vitals">
      {c ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-control tabular-nums sm:grid-cols-5">
          {[
            ['HP', String(maxHp(c))],
            ['Heart die', `d${maxHeartDie(c)}`],
            ['Speed', `${speed(c)} ft`],
            ['DP', String(c.play.dp)],
            ['XP', String(c.xp.awarded)],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-meta text-muted-foreground">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-ui text-muted-foreground">Finish step 2 (race, subrace and its choices) to see HP, heart die and speed.</p>
      )}
    </Section>
  )
}
