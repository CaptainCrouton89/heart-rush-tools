// AI feature 2, "Suggest talents for my concept" (`/advance` and builder step 6): 3–5 cards with the title, the price the
// server quoted (`price()` at the time of the run; the UI computes no price), the model's reason, **Add** and
// **Read in rulebook ↗**. **Add** hands one ordinary `xp:buy` to `onBuy`, built exactly as the catalogue's **Buy** builds it.
// Nothing from the run is saved (INV-AI): only the tap on **Add** creates an action. A card reads **Added** while
// `character` (the caller's document with its unsaved or pending purchases applied) knows the talent, so removing the
// purchase, or a refused or unsaved buy, makes it addable again.
import { useId, useState } from 'react'
import type { Character } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import type { PlayCatalogue } from '~/catalogue'
import { ELEMENTS, elementLabel } from '~/components/advance/elements'
import { talentBuyAction, type XpBuyAction } from '~/components/advance/TalentCatalogue'
import type { SuggestedTalent, SuggestValue } from '~/server/ai'
import { AiFailureLine, Thinking, type AiProblem } from './AiFailure'
import { useAi } from './use-ai'

export type SuggestTalentsProps = {
  characterId: string
  character: Character
  catalogue: PlayCatalogue
  /** Receives the stamped `xp:buy` for an added suggestion, the same action the catalogue's **Buy** gives. */
  onBuy: (action: XpBuyAction) => unknown
}

/** Elemental Affinity's purchase names the element it attunes (as in the catalogue's card). */
const ELEMENTAL_AFFINITY = 'player.talents.elemental-affinity'

export function SuggestTalents({ characterId, character, catalogue, onBuy }: SuggestTalentsProps) {
  const { state, run: ask } = useAi<SuggestValue>({ feature: 'suggest', characterId })
  // The server suggests only talents the character does not know, so a known one was added from this list.
  const known = new Set(character.talents.map((t) => t.catalogueId))

  const problem: AiProblem | null =
    state.status === 'unreachable' ? { kind: 'unreachable' } : state.status === 'done' && state.outcome.kind !== 'result' ? state.outcome : null
  const suggestions = state.status === 'done' && state.outcome.kind === 'result' ? state.outcome.value.suggestions : null

  return (
    <section aria-label="Suggested talents" className="flex flex-col gap-3 rounded-md border border-border bg-surface-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="eyebrow">Suggestions for this character</h2>
        <Button size="compact" type="button" variant={suggestions ? 'line' : 'line-primary'} disabled={state.status === 'loading'} onClick={ask}>
          {suggestions ? 'Suggest again' : 'Suggest talents for my concept'}
        </Button>
      </div>
      {state.status === 'loading' && <Thinking />}
      {problem && <AiFailureLine problem={problem} verb="suggest talents" onRetry={ask} />}
      {suggestions && suggestions.length === 0 && (
        <p className="text-ui text-muted-foreground">No talent the character can afford now is left to suggest.</p>
      )}
      {suggestions && suggestions.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2" aria-live="polite">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.talentId}
              suggestion={s}
              character={character}
              catalogue={catalogue}
              added={known.has(s.talentId)}
              onAdd={onBuy}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function SuggestionCard({
  suggestion: s,
  character,
  catalogue,
  added,
  onAdd,
}: {
  suggestion: SuggestedTalent
  character: Character
  catalogue: PlayCatalogue
  added: boolean
  onAdd: (action: XpBuyAction) => unknown
}) {
  const talent = catalogue.talents.get(s.talentId)
  const needsElement = s.talentId === ELEMENTAL_AFFINITY
  const [element, setElement] = useState('')
  const elementId = useId()

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-h4 font-semibold">{s.title}</h3>
        <span className="shrink-0 text-ui font-semibold tabular-nums">{s.price} XP</span>
      </div>
      <p className="text-meta text-muted-foreground capitalize">{[s.category, s.frequency ?? 'passive'].join(' · ')}</p>
      <p className="text-ui">{s.reason}</p>
      {needsElement && talent && !added && (
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
        <a href={s.rulebookUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
          Read in rulebook ↗
        </a>
        {talent ? (
          <Button size="compact" variant="line-primary"
            type="button"
           
            disabled={added || (needsElement && !element)}
            onClick={() => onAdd(talentBuyAction(talent, needsElement ? element : undefined))}
          >
            {added ? 'Added' : 'Add'}
          </Button>
        ) : (
          <span className="text-meta text-muted-foreground">No longer in the rulebook</span>
        )}
      </div>
    </li>
  )
}
