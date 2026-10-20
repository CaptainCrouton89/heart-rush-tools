// AI feature 1, "Explain this ability", and ruling 14's "Explain this aspect": an icon button that opens four labelled lines
// under it, with **Close**. Each open of a closed panel with no result starts one run; the result stays while the row is
// on screen (in memory only, INV-AI) so reopening it does not run again.
import { useState } from 'react'
import { useMatch } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '@heartrush/ui/components/popover'
import type { AiRequest } from '~/server/ai'
import type { ExplainAspectValue, ExplainValue } from '~/server/ai-prompts'
import { AiFailureLine, Thinking, type AiProblem } from './AiFailure'
import { useAi } from './use-ai'

type Line<V> = { key: keyof V & string; label: string }

const TALENT_LINES: Line<ExplainValue>[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'whenToUse', label: 'When to use' },
  { key: 'cost', label: 'Cost' },
  { key: 'example', label: 'Example' },
]

const ASPECT_LINES: Line<ExplainAspectValue>[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'helps', label: 'Spend DP on it when' },
  { key: 'hurts', label: 'Earn DP from it when' },
  { key: 'example', label: 'Example' },
]

/** Explain one ability: `talentId` is the character's talent record id, or a catalogue talent id for a row it does not own. */
export function ExplainButton({ characterId, talentId, title }: { characterId: string; talentId: string; title?: string }) {
  return (
    <ExplainPopover<ExplainValue>
      request={{ feature: 'explain', characterId, input: { talentId } }}
      lines={TALENT_LINES}
      label={title ? `Explain ${title}` : 'Explain this ability'}
      heading={title ?? 'This ability'}
    />
  )
}

/** Explain one of the character's aspects (ruling 14): when spending DP on it helps, when it earns DP, an example. */
export function ExplainAspectButton({ characterId, aspectId, text }: { characterId: string; aspectId: string; text?: string }) {
  return (
    <ExplainPopover<ExplainAspectValue>
      request={{ feature: 'explainAspect', characterId, input: { aspectId } }}
      lines={ASPECT_LINES}
      label={text ? `Explain the aspect ${text}` : 'Explain this aspect'}
      heading={text ? `“${text}”` : 'This aspect'}
    />
  )
}

/**
 * `ExplainButton` for a row on a character's own page: the sheet, `/advance` or the builder. A sheet section has the
 * character's state but not its id, so the id comes from the route's `$id`. On any other page that reuses these rows
 * (the GM view, where `$id` is the campaign) there is no button.
 */
export function ExplainButtonForRoute({ talentId, title }: { talentId: string; title?: string }) {
  const sheet = useMatch({ from: '/characters/$id', shouldThrow: false })
  const advance = useMatch({ from: '/characters/$id_/advance', shouldThrow: false })
  const build = useMatch({ from: '/characters/$id_/build', shouldThrow: false })
  const characterId = sheet?.params.id ?? advance?.params.id ?? build?.params.id
  return characterId ? <ExplainButton characterId={characterId} talentId={talentId} title={title} /> : null
}

function ExplainPopover<V extends ExplainValue | ExplainAspectValue>({
  request,
  lines,
  label,
  heading,
}: {
  request: AiRequest
  lines: Line<V>[]
  label: string
  heading: string
}) {
  const { state, run, cancel } = useAi<V>(request)
  const [open, setOpen] = useState(false)

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && state.status !== 'done' && state.status !== 'loading') run()
    // Closing while a run is out stops waiting for it; the next open starts again.
    if (!next && state.status === 'loading') cancel()
  }

  const problem: AiProblem | null =
    state.status === 'unreachable' ? { kind: 'unreachable' } : state.status === 'done' && state.outcome.kind !== 'result' ? state.outcome : null
  const value = state.status === 'done' && state.outcome.kind === 'result' ? state.outcome.value : null

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="compact-icon" type="button" variant="ghost" className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={label}>
          <ExplainIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        <p className="eyebrow">Explain · {heading}</p>
        {state.status === 'loading' && <Thinking />}
        {problem && <AiFailureLine problem={problem} verb="explain" onRetry={run} />}
        {value && (
          <dl className="flex flex-col gap-2" aria-live="polite">
            {lines.map((l) => (
              <div key={l.key}>
                <dt className="text-meta font-semibold text-muted-foreground">{l.label}</dt>
                <dd className="text-ui whitespace-pre-line">{String(value[l.key])}</dd>
              </div>
            ))}
          </dl>
        )}
        <Button size="compact" type="button" variant="line" className="self-end" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/** Lucide's message-circle-question glyph. `lucide-react` is not an apps/play dependency; the base styles size `svg.lucide`. */
function ExplainIcon() {
  return (
    <svg className="lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
}
