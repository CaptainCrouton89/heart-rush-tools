// A proposal card (design "Proposal card and Apply", "Checking and applying a line"): the card's lines under builder
// step headings (each heading opens its step), each line's new value with the old one struck through, its reason and a
// remove control, and **Apply**. Every render re-reads each line against the draft as it is now (`lineState`, then
// `checkCard` over the lines still on the card): a line already in the draft shows as written, a line the rules refuse
// or the builder changed shows pencil grey with "Can't apply: ‹reason›". Apply writes through `useDraft` exactly as the
// builder's controls do (`update` and `setPending` once each, then `flush`) and moves the builder to the earliest step it
// changed. Which lines were removed is this screen's state only: the stored card is never edited.
import { useState } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { cn } from '@heartrush/ui/lib/utils'
import { applyCard, checkCard, lineState, lineStep } from '~/assistant/card'
import type { Json, StoredCard, StoredLine } from '~/assistant/schema'
import { getCatalogue } from '~/catalogue'
import { ABILITIES, AGE, STEPS, type StepNumber } from '~/components/builder/draft-rules'
import type { UseDraft } from '~/components/builder/use-draft'

/** How one line reads on the card: the field it writes and its new value in words. */
function describe(line: StoredLine, draft: UseDraft | null): { label: string; value: string; before: string | null } {
  const before = line.before === undefined || line.before === null ? null : shown(line, line.before, draft)
  const catalogue = getCatalogue()
  switch (line.kind) {
    case 'name': return { label: 'Name', value: line.text, before }
    case 'pronouns': return { label: 'Pronouns', value: line.text, before }
    case 'dream': return { label: 'Dream', value: line.text, before }
    case 'aspect': return { label: `Aspect ${line.slot}`, value: line.text, before }
    case 'kin': return { label: 'Kin', value: kinText(line.raceId, line.subraceId), before }
    case 'kinChoice': {
      const choice = choiceOf(line.choiceId, draft)
      const option = choice?.kind === 'options' ? choice.options.find((o) => o.id === line.optionId)?.title : catalogue.talents.get(line.optionId)?.title
      return { label: choice?.title ?? line.choiceId, value: option ?? line.optionId, before }
    }
    case 'die': return { label: abilityLabel(line.ability), value: `d${line.die}`, before }
    case 'age': return { label: 'Age', value: ageText(line), before }
    case 'bloodmarkLevel': return { label: 'Bloodmark level', value: String(line.level), before }
    case 'professions': return { label: 'Professions', value: professionsText(line.professions), before }
    case 'talent': {
      const title = catalogue.talents.get(line.catalogueId)?.title ?? line.catalogueId
      return { label: 'Talent', value: line.attunementElement ? `${title} (${line.attunementElement})` : title, before: null }
    }
    case 'weapon': return { label: 'Weapon', value: `${line.name} (${SIZE[line.size]}, ${DAMAGE[line.damageType]}, ${line.attackType}${line.reach ? ', reach' : ''})`, before: null }
    case 'armor': return { label: 'Armor', value: `${line.name} (${WEIGHT[line.weight]})`, before: null }
    case 'shield': return { label: 'Shield', value: `${line.name} (${WEIGHT[line.weight]})`, before: null }
    case 'item': return { label: 'Item', value: line.quantity > 1 ? `${line.name} ×${line.quantity}` : line.name, before: null }
  }
}

const SIZE = { H: 'heavy', L: 'light', UL: 'ultralight' } as const
const DAMAGE = { B: 'bludgeoning', S: 'slashing', P: 'piercing' } as const
const WEIGHT = { H: 'heavy', M: 'medium', L: 'light', none: 'none' } as const

const abilityLabel = (id: string) => ABILITIES.find((a) => a.id === id)?.label ?? id

function kinText(raceId: string, subraceId: string | null): string {
  const race = getCatalogue().races.get(raceId)
  if (!race) return raceId
  const subrace = race.subraces.find((s) => s.id === subraceId)
  return subrace ? `${race.title} / ${subrace.title}` : race.title
}

/** The choice on the draft's race or subrace (a card's kin line may name another race; then its own race is looked up). */
function choiceOf(choiceId: string, draft: UseDraft | null) {
  const races = getCatalogue().races
  const own = draft ? races.get(draft.builder.raceId) : undefined
  for (const race of own ? [own, ...races.values()] : races.values()) {
    for (const c of [...race.choices, ...race.subraces.flatMap((s) => s.choices)]) if (c.id === choiceId) return c
  }
  return undefined
}

function ageText(v: { ageCategory: keyof typeof AGE; ageBenefits: string[]; deepKnowledgeAspect?: string | null }): string {
  const age = AGE[v.ageCategory]
  const benefits = v.ageBenefits.map((id) => age.benefits.find((b) => b.id === id)?.label ?? id)
  const deep = v.deepKnowledgeAspect ? ` (“${v.deepKnowledgeAspect}”)` : ''
  return benefits.length ? `${age.label}: ${benefits.join(', ')}${deep}` : age.label
}

const professionsText = (rows: { name: string; rank: number }[]) => rows.map((p) => `${p.name} ${p.rank}`).join(', ')

/** A stored `before` in the same words as the line's new value (its shape is the field's, as `card.ts` reads it). */
function shown(line: StoredLine, before: Json, draft: UseDraft | null): string {
  switch (line.kind) {
    case 'kin': {
      const k = before as { raceId: string; subraceId: string | null }
      return kinText(k.raceId, k.subraceId)
    }
    case 'kinChoice': {
      const choice = choiceOf(line.choiceId, draft)
      const id = String(before)
      return (choice?.kind === 'options' ? choice.options.find((o) => o.id === id)?.title : getCatalogue().talents.get(id)?.title) ?? id
    }
    case 'die': return `d${before}`
    case 'age': return ageText(before as Parameters<typeof ageText>[0])
    case 'professions': return professionsText(before as { name: string; rank: number }[])
    default: return String(before)
  }
}

type Row = { line: StoredLine; state: 'applied' | 'open' | 'refused'; reason: string | null }

export function ProposalCard({
  card,
  draft,
  onOpenStep,
  onApplied,
}: {
  card: StoredCard
  /** Null on `/characters/new` before the draft exists: nothing can be applied yet. */
  draft: UseDraft | null
  onOpenStep: (step: StepNumber, show: boolean) => void
  /** After Apply wrote to the draft (the panel marks the Builder tab). */
  onApplied?: () => void
}) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  const [applying, setApplying] = useState(false)
  /** Apply wrote to the draft but saving it failed (the builder's save status says why). */
  const [unsaved, setUnsaved] = useState(false)

  const kept = card.lines.filter((l) => !removed.has(l.id))
  const content = draft ? { builder: draft.builder, pending: draft.pending } : null
  const checks = content ? checkCard(kept, content) : []
  const rows: Row[] = kept.map((line, i) => {
    if (!content) return { line, state: 'open', reason: null }
    if (lineState(line, content) === 'applied') return { line, state: 'applied', reason: null }
    const c = checks[i]!
    return c.ok ? { line, state: 'open', reason: null } : { line, state: 'refused', reason: c.reason }
  })
  const canApply = !applying && rows.some((r) => r.state === 'open')

  // Lines grouped under their step, steps in builder order, lines in card order within a step.
  const steps = [...new Set(rows.map((r) => lineStep(r.line)))].sort((a, b) => a - b)

  async function apply() {
    if (!draft || !content) return
    setApplying(true)
    setUnsaved(false)
    const result = applyCard(kept, content)
    if (result.applied.length > 0) {
      draft.update(() => result.builder)
      draft.setPending(() => result.pending)
    }
    const saved = await draft.flush()
    setApplying(false)
    if (saved === null) {
      // The changes stay in the draft on screen and the builder saves them with its next change.
      setUnsaved(true)
      return
    }
    if (result.applied.length > 0) onApplied?.()
    // The builder moves to the step behind the chat; on phone the Assistant tab stays and Builder gets the dot.
    if (result.earliestStep !== null) onOpenStep(result.earliestStep, false)
  }

  return (
    <section aria-label="Proposed changes" className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
      {steps.map((step) => (
        <div key={step} className="flex flex-col gap-1">
          <h3>
            <button type="button" onClick={() => onOpenStep(step, true)} className="eyebrow section-name inline-flex min-h-11 items-center underline-offset-4 hover:underline">
              {STEPS[step - 1]}
            </button>
          </h3>
          <ul className="flex flex-col gap-2">
            {rows
              .filter((r) => lineStep(r.line) === step)
              .map((r) => (
                <CardLineRow
                  key={r.line.id}
                  row={r}
                  draft={draft}
                  onRemove={() => setRemoved((s) => new Set([...s, r.line.id]))}
                />
              ))}
          </ul>
        </div>
      ))}
      {rows.length === 0 ? (
        <p className="text-ui text-muted-foreground">Every line was removed.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="compact" variant="line-primary" type="button" disabled={!canApply} onClick={() => void apply()}>
            {applying ? 'Applying…' : 'Apply'}
          </Button>
          {unsaved ? (
            <p role="alert" className="text-meta text-muted-foreground">
              Applied to the draft, but saving failed. The builder shows why and tries again with your next change.
            </p>
          ) : (
            !canApply && !applying && rows.every((r) => r.state === 'applied') && <p className="text-meta text-muted-foreground">Applied.</p>
          )}
        </div>
      )}
    </section>
  )
}

function CardLineRow({ row, draft, onRemove }: { row: Row; draft: UseDraft | null; onRemove: () => void }) {
  const { label, value, before } = describe(row.line, draft)
  const refused = row.state === 'refused'
  return (
    <li className={cn('flex items-start gap-2', refused && 'text-muted-foreground')}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-ui font-medium">{label}:</span>
          {before !== null && before !== value && (
            <s className="font-hand text-[15px] text-muted-foreground decoration-primary decoration-[1.5px]">
              <span className="sr-only">was </span>
              {before}
            </s>
          )}
          <span className={cn('font-hand text-[17px]', refused ? 'text-muted-foreground' : 'text-foreground')}>{value}</span>
          {row.state === 'applied' && <span className="text-meta text-muted-foreground">✓ in the draft</span>}
        </p>
        <p className="rules-text text-muted-foreground">{row.line.reason}</p>
        {refused && <p className="text-meta">Can't apply: {row.reason}</p>}
      </div>
      {row.state !== 'applied' && (
        <Button size="compact-icon" variant="ghost" type="button" aria-label={`Remove ${label} from this card`} onClick={onRemove}>
          ×
        </Button>
      )}
    </li>
  )
}
