import { useId, useMemo, useState, type ReactNode } from 'react'
import { ulid } from 'ulid'
import type { PlayTalent, TalentCategory } from '@heartrush/rules-engine/catalogue'
import type { Character, ClientAction, Target } from '@heartrush/rules-engine/types'
import { Input } from '@heartrush/ui/components/input'
import { ToggleGroup, ToggleGroupItem } from '@heartrush/ui/components/toggle-group'
import { rulebookUrl, type PlayCatalogue } from '~/catalogue'
import { BuyButton, quote } from './BuyRow'
import { ELEMENTS, elementLabel } from './elements'
import { ExplainButtonForRoute } from '~/components/ai/ExplainButton'

/** The `xp:buy` action a catalogue Buy produces, already stamped with its ULID `id` and ISO `at` (INV-DET). */
export type XpBuyAction = Extract<ClientAction, { kind: 'xp:buy' }>

export type TalentCatalogueProps = {
  character: Character
  catalogue: PlayCatalogue
  /** Receives the stamped `xp:buy`: `/advance` dispatches it, the builder appends it to the draft's pending list. */
  onBuy: (action: XpBuyAction) => unknown
  /** Shown above the list (I2 mounts Suggest talents here). */
  header?: ReactNode
}

const CATEGORIES: { value: TalentCategory; label: string }[] = [
  { value: 'combat', label: 'Combat' },
  { value: 'noncombat', label: 'Noncombat' },
  { value: 'elemental', label: 'Elemental' },
]

/** Talents.md: only a talent whose text says so may be taken more than once (Elemental Affinity). */
const repeatable = (t: PlayTalent) => /may take this talent multiple times/i.test(t.body)
/** Elemental Affinity's purchase names the element it attunes. */
const attunesElement = (t: PlayTalent) => t.id === 'player.talents.elemental-affinity'

const firstSentence = (body: string) => {
  const line = body.split('\n')[0] ?? ''
  const end = line.search(/[.!?](\s|$)/)
  return end === -1 ? line : line.slice(0, end + 1)
}

/** The catalogue facts the engine prices a talent by (ruling 9, 11): tradition, elements, attunement level. */
export const talentTarget = (t: PlayTalent): Target => ({
  talent: { tradition: t.tradition, elements: t.elements, ...(t.attunementLevel ? { attunementLevel: t.attunementLevel } : {}) },
})

/** Builds the stamped `xp:buy` for a catalogue talent. */
export function talentBuyAction(t: PlayTalent, attunementElement?: string): XpBuyAction {
  return {
    kind: 'xp:buy',
    purchase: `talent:${t.category}`,
    target: talentTarget(t),
    talent: {
      catalogueId: t.id,
      titleSnapshot: t.title,
      frequency: t.frequency ?? 'passive',
      customText: null,
      ...(attunementElement !== undefined ? { attunementElement } : {}),
    },
    id: ulid(),
    at: new Date().toISOString(),
  }
}

/**
 * The talent catalogue with live prices: Combat / Noncombat / Elemental, a search over title and text, and one
 * card per talent with its price from the engine's `price()`, the reason it cannot be bought in plain words, **Buy**
 * and **Read in rulebook ↗**. A talent already known is marked and not offered again unless its text allows it.
 */
export function TalentCatalogue({ character, catalogue, onBuy, header }: TalentCatalogueProps) {
  const [category, setCategory] = useState<TalentCategory>('combat')
  const [query, setQuery] = useState('')
  const searchId = useId()

  const known = useMemo(() => new Set(character.talents.flatMap((t) => (t.catalogueId ? [t.catalogueId] : []))), [character.talents])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...catalogue.talents.values()]
      .filter((t) => t.category === category && (!q || t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [catalogue.talents, category, query])

  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <ToggleGroup
          type="single"
          value={category}
          onValueChange={(v) => v && setCategory(v as TalentCategory)}
          aria-label="Talent kind"
          className="w-full sm:w-fit"
        >
          {CATEGORIES.map((c) => (
            <ToggleGroupItem key={c.value} value={c.value}>
              {c.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <label htmlFor={searchId} className="sr-only">
          Search talents
        </label>
        <Input id={searchId} type="search" placeholder="Search talents" value={query} onChange={(e) => setQuery(e.target.value)} className="h-11 sm:max-w-xs" />
      </div>
      {category === 'elemental' && (
        <p className="text-ui text-muted-foreground">
          Attuned to:{' '}
          {character.attunements.length === 0
            ? 'no element yet (Elemental Affinity, in Noncombat, gives one)'
            : character.attunements.map((a) => `${elementLabel(a.element)} (${a.level})`).join(', ')}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="text-ui text-muted-foreground">No talents match.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((t) => (
            <TalentCard key={t.id} talent={t} character={character} known={known.has(t.id)} onBuy={onBuy} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TalentCard({ talent, character, known, onBuy }: { talent: PlayTalent; character: Character; known: boolean; onBuy: (a: XpBuyAction) => unknown }) {
  const [element, setElement] = useState('')
  const elementId = useId()
  const q = quote(character, `talent:${talent.category}`, talentTarget(talent))
  const blockedByKnown = known && !repeatable(talent)
  const needsElement = attunesElement(talent)
  const facts = [talent.frequency, talent.tradition, talent.elements.length ? talent.elements.join(' or ') : null, talent.attunementLevel ? `${talent.attunementLevel} attunement` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-h4 font-semibold">{talent.title}</h3>
        {known && <span className="shrink-0 text-meta text-muted-foreground">Known</span>}
        <ExplainButtonForRoute talentId={talent.id} title={talent.title} />
      </div>
      {facts && <p className="text-meta text-muted-foreground capitalize">{facts}</p>}
      <details className="text-ui">
        <summary className="flex min-h-11 cursor-pointer items-center">{firstSentence(talent.body)}</summary>
        <p className="whitespace-pre-line text-muted-foreground">{talent.body}</p>
        {talent.destiny && (
          <p className="mt-2 whitespace-pre-line text-muted-foreground">
            <span className="font-semibold text-foreground">Destiny: </span>
            {talent.destiny}
          </p>
        )}
      </details>
      {needsElement && (
        <div className="flex items-center gap-2">
          <label htmlFor={elementId} className="text-ui font-medium">
            Element
          </label>
          <select
            id={elementId}
            value={element}
            onChange={(e) => setElement(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-md border border-input bg-surface px-3 font-sans text-base text-foreground md:text-ui"
          >
            <option value="">Choose an element</option>
            {ELEMENTS.map((el) => {
              const held = character.attunements.find((a) => a.element.toLowerCase() === el)
              // Elemental Affinity attunes a new element at basic or raises a basic one to advanced; nothing else.
              if (held && held.level !== 'basic') return null
              return (
                <option key={el} value={el}>
                  {elementLabel(el)}
                  {held ? ' (basic → advanced)' : ''}
                </option>
              )
            })}
          </select>
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <a href={rulebookUrl(talent.path)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
          Read in rulebook ↗
        </a>
        <BuyButton
          q={q}
          disabled={blockedByKnown || (needsElement && !element)}
          onBuy={() => onBuy(talentBuyAction(talent, needsElement ? element : undefined))}
        />
      </div>
      {q.refusal ? (
        <p className="text-meta text-muted-foreground">Can't buy: {q.refusal}</p>
      ) : blockedByKnown ? (
        <p className="text-meta text-muted-foreground">Already known.</p>
      ) : needsElement && !element ? (
        <p className="text-meta text-muted-foreground">Choose the element to attune.</p>
      ) : null}
    </li>
  )
}
