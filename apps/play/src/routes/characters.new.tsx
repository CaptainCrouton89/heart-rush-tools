// Temporary quick-create form (plan row L0). B1a replaces this file with the 7-step builder.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { ulid } from 'ulid'
import type { AbilityId, BuilderInput } from '@heartrush/rules-engine/types'
import type { PlayChoice, Tradition } from '@heartrush/rules-engine/catalogue'
import { Alert, AlertDescription } from '@heartrush/ui/components/alert'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { ToggleGroup, ToggleGroupItem } from '@heartrush/ui/components/toggle-group'
import { createDraftFn, finishDraftFn, saveDraftFn, type CharacterResult } from '~/server/characters'

type ChoiceOption = { id: string; title: string }
type QuickChoice =
  | { id: string; title: string; text: string; kind: 'options'; options: ChoiceOption[] }
  | { id: string; title: string; text: string; kind: 'talent'; tradition: Tradition | null }
type QuickRace = { id: string; title: string; choices: QuickChoice[]; subraces: { id: string; title: string; choices: QuickChoice[] }[] }
type QuickTalent = { id: string; title: string; tradition: Tradition | null }

/** What the form needs from the catalogue: races, subraces and their creation-time choices, and talent titles for talent choices. */
const quickCreateOptionsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ requireUser }, { getCatalogue }] = await Promise.all([import('~/server/session'), import('~/catalogue')])
  await requireUser()
  const catalogue = getCatalogue()
  const choices = (cs: readonly PlayChoice[]): QuickChoice[] =>
    cs.map((c) =>
      c.kind === 'options'
        ? { id: c.id, title: c.title, text: c.text, kind: 'options', options: c.options.map((o) => ({ id: o.id, title: o.title })) }
        : { id: c.id, title: c.title, text: c.text, kind: 'talent', tradition: c.tradition },
    )
  const races: QuickRace[] = [...catalogue.races.values()]
    .map((r) => ({ id: r.id, title: r.title, choices: choices(r.choices), subraces: r.subraces.map((s) => ({ id: s.id, title: s.title, choices: choices(s.choices) })) }))
    .sort((a, b) => a.title.localeCompare(b.title))
  const talents: QuickTalent[] = [...catalogue.talents.values()]
    .map((t) => ({ id: t.id, title: t.title, tradition: t.tradition }))
    .sort((a, b) => a.title.localeCompare(b.title))
  return { races, talents }
})

export const Route = createFileRoute('/characters/new')({
  loader: () => quickCreateOptionsFn(),
  head: () => ({ meta: [{ title: 'New character · Heart Rush Play' }] }),
  component: QuickCreate,
})

const ABILITIES: { id: AbilityId; label: string }[] = [
  { id: 'might', label: 'Might' },
  { id: 'agility', label: 'Agility' },
  { id: 'cunning', label: 'Cunning' },
  { id: 'presence', label: 'Presence' },
]
type Age = BuilderInput['ageCategory']
const AGE: Record<Age, { label: string; ranks: number; cap: number; picks: number; benefits: { id: string; label: string }[] }> = {
  young: {
    label: 'Young', ranks: 2, cap: 3, picks: 2,
    benefits: [
      { id: 'natural-learner', label: 'Natural Learner' },
      { id: 'fast-healer', label: 'Fast Healer' },
      { id: 'young-and-foolish', label: 'Young and Foolish' },
    ],
  },
  adult: { label: 'Adult', ranks: 4, cap: 3, picks: 0, benefits: [] },
  elderly: {
    label: 'Elderly', ranks: 5, cap: 4, picks: 1,
    benefits: [
      { id: 'wisdom-of-experience', label: 'Wisdom of Experience' },
      { id: 'deep-knowledge', label: 'Deep Knowledge' },
      { id: 'frail-body-sharp-mind', label: 'Frail Body, Sharp Mind' },
    ],
  },
}

const fieldClass = 'flex flex-col gap-2'
const labelClass = 'text-ui font-medium text-foreground'
const selectClass =
  'h-11 w-full rounded-md border border-input bg-surface px-3 font-sans text-base text-foreground md:text-ui disabled:cursor-not-allowed disabled:opacity-50'

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className={fieldClass}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className="text-meta text-muted-foreground">{hint}</p>}
    </div>
  )
}

function QuickCreate() {
  const { races, talents } = Route.useLoaderData()
  const navigate = useNavigate()
  const ids = useId()

  const [name, setName] = useState('')
  const [raceId, setRaceId] = useState('')
  const [subraceId, setSubraceId] = useState('')
  const [kinChoices, setKinChoices] = useState<Record<string, string>>({})
  const [dice, setDice] = useState<Partial<Record<AbilityId, 4 | 6>>>({})
  const [age, setAge] = useState<Age>('adult')
  const [benefits, setBenefits] = useState<string[]>([])
  const [deepKnowledge, setDeepKnowledge] = useState('')
  const [wisdomProfession, setWisdomProfession] = useState('')
  const [professions, setProfessions] = useState<{ name: string; rank: string }[]>([{ name: '', rank: '' }, { name: '', rank: '' }, { name: '', rank: '' }])
  const [aspects, setAspects] = useState<[string, string]>(['', ''])
  // The draft already written by an earlier attempt that the rules refused; a retry saves over it instead of making another.
  const [draft, setDraft] = useState<{ id: string; revision: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const race = races.find((r) => r.id === raceId)
  const subrace = race?.subraces.find((s) => s.id === subraceId)
  const choices = useMemo(() => [...(race?.choices ?? []), ...(subrace?.choices ?? [])], [race, subrace])
  const ageRule = AGE[age]
  const filledProfessions = professions.filter((p) => p.name.trim() || p.rank)
  const rankTotal = filledProfessions.reduce((n, p) => n + (Number(p.rank) || 0), 0)
  const diceCount = (d: 4 | 6) => ABILITIES.filter((a) => dice[a.id] === d).length

  const problems: string[] = []
  if (!name.trim()) problems.push('Give the character a name.')
  if (!race) problems.push('Choose a race.')
  if (race && race.subraces.length > 0 && !subrace) problems.push('Choose a subrace.')
  for (const c of choices) if (!kinChoices[c.id]) problems.push(`Choose ${c.title}.`)
  if (diceCount(6) !== 2 || diceCount(4) !== 2) problems.push('Assign exactly two d6 and two d4.')
  if (benefits.length !== ageRule.picks) problems.push(`Choose ${ageRule.picks === 2 ? 'two' : 'one'} ${ageRule.label.toLowerCase()} benefit${ageRule.picks === 2 ? 's' : ''}.`)
  if (benefits.includes('deep-knowledge') && !deepKnowledge.trim()) problems.push('Write the Deep Knowledge aspect.')
  if (benefits.includes('wisdom-of-experience') && !filledProfessions.some((p) => p.name.trim() === wisdomProfession.trim() && wisdomProfession.trim()))
    problems.push('Choose the profession Wisdom of Experience applies to.')
  if (filledProfessions.length === 0 || filledProfessions.some((p) => !p.name.trim() || !(Number(p.rank) >= 1)))
    problems.push('Each profession needs a name and a rank of at least 1.')
  if (rankTotal !== ageRule.ranks) problems.push(`Profession ranks must add up to ${ageRule.ranks} (now ${rankTotal}).`)
  if (filledProfessions.some((p) => Number(p.rank) > ageRule.cap)) problems.push(`No profession may have more than ${ageRule.cap} ranks.`)
  if (!aspects[0].trim() || !aspects[1].trim()) problems.push('Write both aspects.')

  function chooseRace(id: string) {
    setRaceId(id)
    setSubraceId('')
    setKinChoices({})
  }
  function chooseSubrace(id: string) {
    setSubraceId(id)
    setKinChoices((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => race?.choices.some((c) => c.id === k))))
  }
  function chooseAge(next: Age) {
    setAge(next)
    setBenefits([])
  }
  function toggleBenefit(id: string) {
    setBenefits((prev) => (ageRule.picks === 1 ? [id] : prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (problems.length > 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const id = draft?.id ?? ulid()
      const builder: BuilderInput = {
        id, at: new Date().toISOString(),
        name: name.trim(), pronouns: '', dream: '', description: '', motivation: '', portrait: null,
        raceId, subraceId: subrace ? subrace.id : null, kinChoices, spelltouched: false,
        dice: dice as Record<AbilityId, 4 | 6>,
        ageCategory: age, ageBenefits: benefits,
        ...(benefits.includes('deep-knowledge') ? { deepKnowledgeAspect: deepKnowledge.trim() } : {}),
        ...(benefits.includes('wisdom-of-experience') ? { ageBenefitProfession: wisdomProfession.trim() } : {}),
        createdAspects: [aspects[0].trim(), aspects[1].trim()],
        professions: filledProfessions.map((p) => ({ name: p.name.trim(), rank: Number(p.rank) })),
        bloodmarkLevel: 0,
      }
      const saved: CharacterResult = draft
        ? await saveDraftFn({ data: { characterId: draft.id, revision: draft.revision, builder, pending: [] } })
        : await createDraftFn({ data: { builder } })
      if (!saved.ok) {
        setError(saved.message)
        return
      }
      setDraft({ id: saved.character.id, revision: saved.character.revision })
      const finished = await finishDraftFn({ data: { characterId: saved.character.id, revision: saved.character.revision } })
      if (!finished.ok) {
        setError(finished.invalid?.map((i) => i.message).join(' ') || finished.message)
        return
      }
      await navigate({ href: `/characters/${finished.character.id}` })
    } catch {
      setError('Not saved — no connection. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pt-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-h1-sm font-semibold md:text-h1">New character</h1>
        <p className="text-ui text-muted-foreground">The quick form: everything a finished character needs. Talents and gear come later from the sheet.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <Field label="Name" htmlFor={`${ids}-name`}>
          <Input id={`${ids}-name`} className="h-11" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>

        <Field label="Race" htmlFor={`${ids}-race`}>
          <select id={`${ids}-race`} className={selectClass} value={raceId} onChange={(e) => chooseRace(e.target.value)}>
            <option value="">Choose a race</option>
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>

        {race && race.subraces.length > 0 && (
          <Field label="Subrace" htmlFor={`${ids}-subrace`}>
            <select id={`${ids}-subrace`} className={selectClass} value={subraceId} onChange={(e) => chooseSubrace(e.target.value)}>
              <option value="">Choose a subrace</option>
              {race.subraces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        {choices.map((c) => {
          const options =
            c.kind === 'options' ? c.options : talents.filter((t) => c.tradition === null || t.tradition === c.tradition).map((t) => ({ id: t.id, title: t.title }))
          return (
            <Field key={c.id} label={c.title} htmlFor={`${ids}-choice-${c.id}`} hint={c.text}>
              <select
                id={`${ids}-choice-${c.id}`}
                className={selectClass}
                value={kinChoices[c.id] ?? ''}
                onChange={(e) => setKinChoices((prev) => ({ ...prev, [c.id]: e.target.value }))}
              >
                <option value="">{c.kind === 'talent' ? 'Choose a talent' : 'Choose one'}</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            </Field>
          )
        })}

        <fieldset className="flex flex-col gap-3">
          <legend className={labelClass}>Ability dice</legend>
          <p className="text-meta text-muted-foreground">
            Two abilities start at d6 and two at d4. Assigned: {diceCount(6)} of 2 d6, {diceCount(4)} of 2 d4.
          </p>
          {ABILITIES.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-4">
              <span id={`${ids}-die-${a.id}`} className="text-control text-foreground">
                {a.label}
              </span>
              <ToggleGroup
                type="single"
                aria-labelledby={`${ids}-die-${a.id}`}
                value={dice[a.id] ? `d${dice[a.id]}` : ''}
                onValueChange={(v) => setDice((prev) => ({ ...prev, [a.id]: v === 'd6' ? 6 : v === 'd4' ? 4 : undefined }))}
              >
                <ToggleGroupItem value="d6" className="min-w-16">
                  d6
                </ToggleGroupItem>
                <ToggleGroupItem value="d4" className="min-w-16">
                  d4
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className={labelClass}>Age</legend>
          <ToggleGroup type="single" aria-label="Age" value={age} onValueChange={(v) => v && chooseAge(v as Age)} className="w-full">
            {(Object.keys(AGE) as Age[]).map((a) => (
              <ToggleGroupItem key={a} value={a}>
                {AGE[a].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {ageRule.picks > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-meta text-muted-foreground">Choose {ageRule.picks === 2 ? 'two' : 'one'}:</p>
              {ageRule.benefits.map((b) => (
                <label key={b.id} className="flex min-h-11 items-center gap-3 text-control text-foreground">
                  <input
                    type={ageRule.picks === 1 ? 'radio' : 'checkbox'}
                    name={`${ids}-benefit`}
                    className="size-5 accent-primary"
                    checked={benefits.includes(b.id)}
                    disabled={ageRule.picks === 2 && benefits.length >= 2 && !benefits.includes(b.id)}
                    onChange={() => toggleBenefit(b.id)}
                  />
                  {b.label}
                </label>
              ))}
            </div>
          )}
          {benefits.includes('deep-knowledge') && (
            <Field label="Deep Knowledge aspect (rank 3)" htmlFor={`${ids}-deep`}>
              <Input id={`${ids}-deep`} className="h-11" value={deepKnowledge} onChange={(e) => setDeepKnowledge(e.target.value)} />
            </Field>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className={labelClass}>Professions</legend>
          <p className="text-meta text-muted-foreground">
            Up to three. Ranks add up to {ageRule.ranks} ({rankTotal} now), at most {ageRule.cap} in one profession.
          </p>
          {professions.map((p, i) => (
            <div key={i} className="flex gap-3">
              <Input
                aria-label={`Profession ${i + 1}`}
                className="h-11 flex-1"
                value={p.name}
                onChange={(e) => setProfessions((prev) => prev.map((q, j) => (j === i ? { ...q, name: e.target.value } : q)))}
              />
              <Input
                aria-label={`Profession ${i + 1} rank`}
                className="h-11 w-20"
                inputMode="numeric"
                pattern="[0-9]*"
                value={p.rank}
                onChange={(e) => setProfessions((prev) => prev.map((q, j) => (j === i ? { ...q, rank: e.target.value.replace(/\D/g, '') } : q)))}
              />
            </div>
          ))}
          {benefits.includes('wisdom-of-experience') && (
            <Field label="Wisdom of Experience applies to" htmlFor={`${ids}-wisdom`}>
              <select id={`${ids}-wisdom`} className={selectClass} value={wisdomProfession} onChange={(e) => setWisdomProfession(e.target.value)}>
                <option value="">Choose a profession</option>
                {filledProfessions
                  .filter((q) => q.name.trim())
                  .map((q) => (
                    <option key={q.name} value={q.name.trim()}>
                      {q.name.trim()}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className={labelClass}>Two aspects you write</legend>
          {aspects.map((text, i) => (
            <Input
              key={i}
              aria-label={`Aspect ${i + 1}`}
              className="h-11"
              value={text}
              onChange={(e) => setAspects((prev) => (i === 0 ? [e.target.value, prev[1]] : [prev[0], e.target.value]))}
            />
          ))}
        </fieldset>

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {problems.length > 0 && (
          <ul className="list-disc pl-5 text-meta text-muted-foreground" aria-live="polite">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <Button type="submit" size="lg" disabled={problems.length > 0 || busy} className="self-start">
          {busy ? 'Creating…' : 'Create character'}
        </Button>
      </form>
    </div>
  )
}
