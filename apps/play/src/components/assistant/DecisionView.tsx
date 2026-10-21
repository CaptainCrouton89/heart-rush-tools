// The one decision an assistant turn asks (design "Each turn"): 2–4 options as line buttons, each with its one-sentence
// feel and a rules link (new tab); **You decide**; and **See all** when the turn offers the full kin or talent list.
// Tapping an option or You decide sends its words as the player's message; it never changes the character.
import { Button } from '@heartrush/ui/components/button'
import type { TurnDecision } from '~/assistant/schema'
import type { StepNumber } from '~/components/builder/draft-rules'

/** What **You decide** sends. */
export const YOU_DECIDE = 'You decide'

const SEE_ALL: Record<NonNullable<TurnDecision['seeAll']>, { label: string; step: StepNumber }> = {
  kin: { label: 'See all kin', step: 2 },
  talents: { label: 'See all talents', step: 6 },
}

export function DecisionView({
  decision,
  onSend,
  onOpenStep,
  disabled,
}: {
  decision: TurnDecision
  onSend: (text: string) => void
  /** Opens a builder step (on phone, switching to the Builder tab). */
  onOpenStep: (step: StepNumber, show: boolean) => void
  /** Options do not send while a run is in flight, or on a decision an answer already followed. */
  disabled: boolean
}) {
  const seeAll = decision.seeAll ? SEE_ALL[decision.seeAll] : null
  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="rules-text font-semibold">{decision.question}</p>
      <ul className="flex flex-col gap-3">
        {decision.options.map((o) => (
          <li key={o.label} className="flex flex-col items-start gap-1">
            <Button size="compact" variant="line" type="button" className="h-auto min-h-[30px] max-w-full py-1 text-left whitespace-normal" disabled={disabled} onClick={() => onSend(o.label)}>
              {o.label}
            </Button>
            <p className="rules-text text-muted-foreground">
              {o.feel}{' '}
              <a href={o.link} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center align-middle text-ui text-primary underline underline-offset-4">
                Rules ↗
              </a>
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button size="compact" variant="line" type="button" disabled={disabled} onClick={() => onSend(YOU_DECIDE)}>
          {YOU_DECIDE}
        </Button>
        {seeAll && (
          <Button size="compact" variant="line" type="button" onClick={() => onOpenStep(seeAll.step, true)}>
            {seeAll.label}
          </Button>
        )}
      </div>
    </div>
  )
}
