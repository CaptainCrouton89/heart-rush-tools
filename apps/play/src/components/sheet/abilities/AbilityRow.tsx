import { useId, useState, type ReactNode } from 'react'
import { minorUseCost } from '@heartrush/rules-engine/derived'
import type { Talent } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import { resolveRef, rulebookUrl, type PlayCatalogue } from '~/catalogue'
import type { SectionProps } from '../SheetLayout'

const FREQUENCY_LABEL: Record<Talent['frequency'], string> = {
  minor: 'minor',
  major: 'major',
  weekly: 'weekly',
  monthly: 'monthly',
  passive: 'passive',
}

/** When a used ability comes back: majors on a long rest; weekly and monthly by the Reset tap (design D13). */
const RETURNS: Partial<Record<Talent['frequency'], string>> = { major: 'long rest' }

/**
 * One ability. The title is the catalogue entry's when its id resolves; an id that no longer resolves shows the
 * stored title and "no longer in the rulebook" (INV-CATREF). A row with no catalogue id (a racial ability, a
 * bloodmark or custom ability) carries its own text. Minor: cost `usesThisFight + 1` rush. Major, weekly, monthly:
 * used state; weekly and monthly get a manual **Reset**. **Use** is 48 px; a refusal (for example not enough rush
 * points) shows in the sheet's chip. The rules text expands on a phone and is always open from 1024 px.
 * `extra` is a slot for a per-row control (I2's Explain button).
 */
export function AbilityRow({
  talent,
  rushPoints,
  catalogue,
  dispatch,
  canEdit,
  extra,
}: {
  talent: Talent
  rushPoints: number
  catalogue: PlayCatalogue
  dispatch: SectionProps['dispatch']
  canEdit: boolean
  extra?: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const textId = useId()
  const ref = talent.catalogueId === null ? null : resolveRef(catalogue.talents, talent)
  const title = ref ? ref.title : talent.titleSnapshot
  const unresolved = ref?.unresolved ?? false
  const entry = ref?.entry ?? null
  const body = entry?.body ?? talent.customText ?? ''
  const destiny = talent.destiny ? entry?.destiny ?? null : null

  const minor = talent.frequency === 'minor'
  const periodic = talent.frequency === 'major' || talent.frequency === 'weekly' || talent.frequency === 'monthly'
  const used = periodic && talent.usedThisPeriod
  const cost = minorUseCost(talent)
  const canReset = used && (talent.frequency === 'weekly' || talent.frequency === 'monthly')

  return (
    <li className="flex flex-col gap-1 border-b border-border py-2 last:border-b-0">
      <div className="flex min-h-12 items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 font-serif text-[18px] leading-6 font-semibold">
            <span className="min-w-0">{title}</span>
            {talent.destiny && <span className="font-sans text-meta font-semibold text-primary">destiny</span>}
          </p>
          <p className="flex flex-wrap gap-x-2 text-meta text-muted-foreground tabular-nums">
            <span>{FREQUENCY_LABEL[talent.frequency]}</span>
            {minor && (
              <span className={cost > rushPoints ? 'text-primary' : undefined}>
                · cost {cost} rush{talent.usesThisFight > 0 && ` (used ${talent.usesThisFight}× this fight)`}
              </span>
            )}
            {used && (
              <span className="font-medium text-foreground">
                · ✓ used{RETURNS[talent.frequency] && ` (${RETURNS[talent.frequency]})`}
              </span>
            )}
            {unresolved && <span className="text-primary">· no longer in the rulebook</span>}
          </p>
        </div>
        {extra}
        {canEdit && canReset && (
          <Button size="compact" type="button" variant="ghost" className="shrink-0 px-3" onClick={() => void dispatch({ kind: 'ability:reset', talentId: talent.id })}>
            Reset
          </Button>
        )}
        {canEdit && talent.frequency !== 'passive' && (
          <Button size="compact-lg"
            type="button"
            variant={used ? 'line' : 'line-primary'}
            className="shrink-0"
            disabled={used}
            aria-label={`Use ${title}`}
            onClick={() => void dispatch({ kind: 'ability:use', talentId: talent.id })}
          >
            Use
          </Button>
        )}
      </div>
      {(body || destiny || entry) && (
        <>
          <button
            type="button"
            className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-sm px-2 text-meta text-muted-foreground hover:bg-surface-muted hover:text-foreground lg:hidden"
            aria-expanded={expanded}
            aria-controls={textId}
            onClick={() => setExpanded((e) => !e)}
          >
            <span aria-hidden>{expanded ? '▾' : '▸'}</span> {expanded ? 'Hide text' : 'Rules text'}
          </button>
          <div id={textId} className={`${expanded ? 'flex' : 'hidden'} flex-col gap-2 pb-1 lg:flex`}>
            {body && <p className="rules-text whitespace-pre-line">{body}</p>}
            {destiny && (
              <p className="rules-text whitespace-pre-line">
                <span className="font-semibold">Destiny: </span>
                {destiny}
              </p>
            )}
            {entry && (
              <a href={rulebookUrl(entry.path)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 w-fit items-center text-meta text-primary underline underline-offset-4">
                Read in rulebook ↗
              </a>
            )}
          </div>
        </>
      )}
    </li>
  )
}
