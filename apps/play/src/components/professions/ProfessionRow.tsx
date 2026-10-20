import { professionProgress } from '@heartrush/rules-engine/professions'
import type { Character, Profession } from '@heartrush/rules-engine/types'
import { Button } from '@heartrush/ui/components/button'
import type { ReactNode } from 'react'
import type { ActionDraft } from '~/components/sheet/use-character'

/** "2 Apprentice → Journeyman"; rank 0 has no name, and the table names nothing past Legendary. */
function rankLine(rank: number, rankName: string, nextRankName: string | null, highest: boolean): string {
  const here = rankName ? `${rank} ${rankName}` : String(rank)
  if (highest) return here
  return `${here} → ${nextRankName ?? `rank ${rank + 1}`}`
}

/**
 * One profession's progress toward its next rank (spec §5), from the engine's `professionProgress` (INV-DERIVED:
 * nothing here is stored). Every control dispatches one `profession:*` progress action, so undo and history work as
 * for any sheet change. `canEdit` false shows the same numbers without controls.
 */
export function ProfessionRow({
  character,
  profession,
  dispatch,
  canEdit,
}: {
  character: Character
  profession: Profession
  dispatch: (action: ActionDraft) => unknown
  canEdit: boolean
}) {
  const p = professionProgress(character, profession.id)
  const professionId = profession.id
  const missionDone = profession.missions >= 1
  const name = profession.name || 'Unnamed profession'

  return (
    <li className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3">
        <h3 className="font-sans text-control font-semibold">{name}</h3>
        {profession.rerollOnes && (
          <span className="text-meta text-muted-foreground">Wisdom of Experience: reroll 1s</span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-ui tabular-nums">
        <span>{rankLine(p.rank, p.rankName, p.nextRankName, p.highest)}</span>
        <span className="text-muted-foreground">Challenge CN ≥ {p.challengeCn}</span>
      </div>

      {p.highest ? (
        <p className="min-h-11 content-center text-ui font-medium">Highest rank</p>
      ) : (
        <>
          <dl className="flex flex-col text-ui tabular-nums">
            <Counter label="Challenges" value={`${profession.challenges} / ${p.challengesNeeded}`}>
              {canEdit && (
                <Button size="compact" type="button" variant="line" className="px-3" aria-label={`Add a challenge to ${name}`} onClick={() => void dispatch({ kind: 'profession:challenge', professionId })}>
                  +1
                </Button>
              )}
            </Counter>
            <Counter label="Mission" value={p.missionRequired ? (missionDone ? 'done' : 'required') : 'not required'}>
              {canEdit && p.missionRequired && (
                <Button size="compact"
                  type="button"
                  variant={missionDone ? 'secondary' : 'line'}
                  role="checkbox"
                  aria-checked={missionDone}
                  aria-label={`Mission done for ${name}`}
                  className="px-3"
                  onClick={() => void dispatch({ kind: 'profession:mission', professionId, done: !missionDone })}
                >
                  {missionDone ? '✓ Done' : 'Done'}
                </Button>
              )}
            </Counter>
            <Counter label="Practice" value={`${profession.practiceWeeks} / ${p.practiceNeeded} weeks`}>
              {canEdit && (
                <Button size="compact" type="button" variant="line" className="px-3" aria-label={`Add a week of practice to ${name}`} onClick={() => void dispatch({ kind: 'profession:practice', professionId })}>
                  +1 week
                </Button>
              )}
            </Counter>
          </dl>
          {canEdit && (
            <Button size="compact" variant="line-primary" type="button" className="mt-1 self-end" disabled={!p.canAdvance} onClick={() => void dispatch({ kind: 'profession:advance', professionId })}>
              Advance to rank {p.rank + 1}
            </Button>
          )}
        </>
      )}
    </li>
  )
}

function Counter({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-3">
        <span className="font-semibold">{value}</span>
        {children}
      </dd>
    </div>
  )
}
