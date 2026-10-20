import { useId, useMemo, useState } from 'react'
import type { PlayAbility, PlayChoice, PlayRace, PlaySubrace } from '@heartrush/rules-engine/catalogue'
import { Input } from '@heartrush/ui/components/input'
import { cn } from '@heartrush/ui/lib/utils'
import { getCatalogue, raceImageUrl, rulebookUrl } from '~/catalogue'
import { Section } from '~/components/sheet/SheetLayout'
import { labelClass, type UseDraft } from './use-draft'

const FREQUENCY: Record<string, string> = { passive: 'Passive', minor: 'Minor', major: 'Major', weekly: 'Weekly', monthly: 'Monthly' }

const optionClass = (selected: boolean) =>
  cn(
    'flex w-full min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
    selected ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-surface hover:bg-surface-muted',
  )

/**
 * Step 2 (Kin & culture): a searchable race list with the rules-site image (ruling 23), size and aspects; the subrace
 * when the race has them; every creation-time choice the race text asks for (kin-choices contract); and the aspects
 * and abilities the character will receive. Changing the race clears only the subrace and the kin choices.
 */
export function StepKin({ draft }: { draft: UseDraft }) {
  const catalogue = getCatalogue()
  const { builder, update } = draft
  const races = useMemo(() => [...catalogue.races.values()].sort((a, b) => a.title.localeCompare(b.title)), [catalogue])
  const race = catalogue.races.get(builder.raceId) ?? null
  const subrace = race?.subraces.find((s) => s.id === builder.subraceId) ?? null

  function chooseRace(next: PlayRace) {
    if (next.id === builder.raceId) return
    update({ raceId: next.id, subraceId: null, kinChoices: {} })
  }
  function chooseSubrace(next: PlaySubrace) {
    if (!race || next.id === builder.subraceId) return
    // Answers to the race's own choices stay; the old subrace's answers go.
    const keep = new Set(race.choices.map((c) => c.id))
    update({ subraceId: next.id, kinChoices: Object.fromEntries(Object.entries(builder.kinChoices).filter(([k]) => keep.has(k))) })
  }
  const answer = (choiceId: string, value: string) => update((b) => ({ ...b, kinChoices: { ...b.kinChoices, [choiceId]: value } }))

  return (
    <div className="flex flex-col gap-8">
      <p className="font-serif text-body-sm text-muted-foreground">
        Choose a race. You gain the aspects and abilities of the race and, when it has them, of one subrace.
      </p>
      <RaceList races={races} selected={race?.id ?? null} onChoose={chooseRace} />

      {race && (
        <div className="flex flex-col gap-6">
          <RaceHeader race={race} />
          <Abilities title={`${race.title} abilities`} abilities={race.abilities} />
          {race.choices.map((c) => (
            <Choice key={c.id} choice={c} value={builder.kinChoices[c.id] ?? ''} onChange={(v) => answer(c.id, v)} />
          ))}

          {race.subraces.length > 0 && (
            <fieldset className="flex flex-col gap-3">
              <legend className={cn(labelClass, 'mb-3')}>Subrace</legend>
              <ul className="flex flex-col gap-2">
                {race.subraces.map((s) => (
                  <li key={s.id}>
                    <label className={optionClass(s.id === subrace?.id)}>
                      <input
                        type="radio"
                        name="subrace"
                        className="size-5 shrink-0 accent-primary"
                        checked={s.id === subrace?.id}
                        onChange={() => chooseSubrace(s)}
                      />
                      <span className="flex flex-col">
                        <span className="text-control font-medium">{s.title}</span>
                        {s.aspects.length > 0 && <span className="text-meta text-muted-foreground">{s.aspects.join(' · ')}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {subrace && (
            <>
              <Abilities title={`${subrace.title} abilities`} abilities={subrace.abilities} />
              {subrace.choices.map((c) => (
                <Choice key={c.id} choice={c} value={builder.kinChoices[c.id] ?? ''} onChange={(v) => answer(c.id, v)} />
              ))}
            </>
          )}

          <Receives race={race} subrace={subrace} kinChoices={builder.kinChoices} />
        </div>
      )}
    </div>
  )
}

function RaceList({ races, selected, onChoose }: { races: PlayRace[]; selected: string | null; onChoose: (race: PlayRace) => void }) {
  const ids = useId()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? races.filter((r) => r.title.toLowerCase().includes(q) || r.subraces.some((s) => s.title.toLowerCase().includes(q))) : races
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${ids}-search`} className={labelClass}>
        Race
      </label>
      <Input id={`${ids}-search`} className="h-11" type="search" placeholder="Search races" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul aria-label="Races" className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-md border border-border p-1">
        {shown.length === 0 && <li className="px-3 py-2 text-ui text-muted-foreground">No race matches “{query}”.</li>}
        {shown.map((r) => {
          const image = raceImageUrl(r)
          const isSelected = r.id === selected
          return (
            <li key={r.id}>
              <button type="button" aria-pressed={isSelected} onClick={() => onChoose(r)} className={optionClass(isSelected)}>
                {image ? (
                  <img src={image} alt="" width={40} height={40} loading="lazy" className="size-10 shrink-0 rounded-sm border border-border bg-surface-muted object-cover" />
                ) : (
                  <span aria-hidden="true" className="size-10 shrink-0" />
                )}
                <span className="flex min-w-0 flex-col">
                  <span className="text-control font-medium">{r.title}</span>
                  <span className="truncate text-meta text-muted-foreground">
                    {[r.size, r.aspects.join(' · ') || null, r.subraces.length > 0 ? `${r.subraces.length} subraces` : null].filter(Boolean).join(' — ')}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function RaceHeader({ race }: { race: PlayRace }) {
  const image = raceImageUrl(race)
  return (
    <div className="flex items-start gap-4">
      {image && <img src={image} alt="" width={96} height={96} className="size-24 shrink-0 rounded-md border border-border bg-surface-muted object-cover" />}
      <div className="flex flex-col gap-1">
        <h2 className="font-serif text-h2-sm font-semibold">{race.title}</h2>
        {race.size && <p className="text-ui text-muted-foreground">Size: {race.size}</p>}
        <a href={rulebookUrl(race.path)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
          Read in rulebook ↗
        </a>
      </div>
    </div>
  )
}

function Ability({ ability }: { ability: PlayAbility }) {
  return (
    <li className="flex flex-col gap-1">
      <span className="text-control font-medium">
        {ability.title}
        {ability.frequency && <span className="ml-2 text-meta font-normal text-muted-foreground">{FREQUENCY[ability.frequency]}</span>}
      </span>
      <p className="text-body-sm whitespace-pre-line text-muted-foreground">{ability.body}</p>
    </li>
  )
}

function Abilities({ title, abilities }: { title: string; abilities: PlayAbility[] }) {
  if (abilities.length === 0) return null
  return (
    <Section title={title}>
      <ul className="flex flex-col gap-4">
        {abilities.map((a) => (
          <Ability key={a.title} ability={a} />
        ))}
      </ul>
    </Section>
  )
}

/** One creation-time choice: `options` as a radio group with each option's abilities; `talent` as a searchable picker. */
function Choice({ choice, value, onChange }: { choice: PlayChoice; value: string; onChange: (value: string) => void }) {
  if (choice.kind === 'talent') return <TalentChoice choice={choice} value={value} onChange={onChange} />
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={cn(labelClass, 'mb-1')}>{choice.title}</legend>
      <p className="text-meta text-muted-foreground">{choice.text}</p>
      <ul className="flex flex-col gap-2">
        {choice.options.map((o) => (
          <li key={o.id}>
            <label className={cn(optionClass(o.id === value), 'items-start')}>
              <input type="radio" name={`choice-${choice.id}`} className="mt-0.5 size-5 shrink-0 accent-primary" checked={o.id === value} onChange={() => onChange(o.id)} />
              <span className="flex flex-col gap-1">
                <span className="text-control font-medium">{o.title}</span>
                {o.abilities.map((a) => (
                  <span key={a.title} className="text-meta text-muted-foreground">
                    <span className="font-medium text-foreground">{a.title}.</span> {a.body}
                  </span>
                ))}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

const TALENTS_SHOWN = 40

function TalentChoice({ choice, value, onChange }: { choice: Extract<PlayChoice, { kind: 'talent' }>; value: string; onChange: (value: string) => void }) {
  const ids = useId()
  const catalogue = getCatalogue()
  const [query, setQuery] = useState('')
  const all = useMemo(
    () => [...catalogue.talents.values()].filter((t) => choice.tradition === null || t.tradition === choice.tradition).sort((a, b) => a.title.localeCompare(b.title)),
    [catalogue, choice.tradition],
  )
  const chosen = catalogue.talents.get(value)
  const q = query.trim().toLowerCase()
  const matches = q ? all.filter((t) => t.title.toLowerCase().includes(q)) : all
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${ids}-search`} className={labelClass}>
        {choice.title}
        {choice.tradition && <span className="ml-2 text-meta font-normal text-muted-foreground">{choice.tradition} talents</span>}
      </label>
      <p className="text-meta text-muted-foreground">{choice.text}</p>
      <p className="text-ui" aria-live="polite">
        {chosen ? (
          <>
            Chosen: <span className="font-medium">{chosen.title}</span>
          </>
        ) : (
          <span className="text-muted-foreground">No talent chosen yet.</span>
        )}
      </p>
      <Input id={`${ids}-search`} className="h-11" type="search" placeholder="Search talents" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul aria-label={`${choice.title} talents`} className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border border-border p-1">
        {matches.slice(0, TALENTS_SHOWN).map((t) => (
          <li key={t.id}>
            <button type="button" aria-pressed={t.id === value} onClick={() => onChange(t.id)} className={optionClass(t.id === value)}>
              <span className="flex min-w-0 flex-col">
                <span className="text-control font-medium">{t.title}</span>
                <span className="truncate text-meta text-muted-foreground">{[t.category, t.tradition, t.frequency && FREQUENCY[t.frequency]].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          </li>
        ))}
        {matches.length > TALENTS_SHOWN && (
          <li className="px-3 py-2 text-meta text-muted-foreground">{matches.length - TALENTS_SHOWN} more — search to narrow the list.</li>
        )}
        {matches.length === 0 && <li className="px-3 py-2 text-ui text-muted-foreground">No talent matches “{query}”.</li>}
      </ul>
    </div>
  )
}

/** Everything the character gets from kin: aspects (rank 1) and abilities, including the chosen options and talents. */
function Receives({ race, subrace, kinChoices }: { race: PlayRace; subrace: PlaySubrace | null; kinChoices: Record<string, string> }) {
  const catalogue = getCatalogue()
  const aspects = [...race.aspects, ...(subrace?.aspects ?? [])]
  const lines: string[] = [...race.abilities, ...(subrace?.abilities ?? [])].map((a) => a.title)
  for (const c of [...race.choices, ...(subrace?.choices ?? [])]) {
    const v = kinChoices[c.id]
    if (!v) lines.push(`${c.title}: not chosen yet`)
    else if (c.kind === 'options') {
      const o = c.options.find((x) => x.id === v)
      lines.push(o ? `${c.title}: ${o.title}${o.abilities.length ? ` (${o.abilities.map((a) => a.title).join(', ')})` : ''}` : `${c.title}: not chosen yet`)
    } else lines.push(`${c.title}: ${catalogue.talents.get(v)?.title ?? 'not chosen yet'} (talent)`)
  }
  for (const a of [...race.abilities, ...(subrace?.abilities ?? [])]) {
    const granted = a.grants && catalogue.talents.get(a.grants.talentId)
    if (granted) lines.push(`${granted.title} (talent${a.grants!.destiny ? ', with its destiny level' : ''})`)
  }
  return (
    <Section title="You receive">
      <div className="flex flex-col gap-3 text-ui">
        <p>
          <span className="font-medium">Aspects (rank 1): </span>
          {aspects.length > 0 ? aspects.join(' · ') : <span className="text-muted-foreground">none from kin</span>}
        </p>
        <div>
          <span className="font-medium">Abilities: </span>
          <ul className="mt-1 list-disc pl-5">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}
