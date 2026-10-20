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

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "2 challenges, the mission and 6 weeks to go"; empty once everything is met. */
function stillOwed(left: string[]): string {
  if (left.length === 0) return ''
  if (left.length === 1) return `${left[0]} to go`
  return `${left.slice(0, -1).join(', ')} and ${left.at(-1)} to go`
}

/**
 * One profession's progress toward its next rank (spec §5), from the engine's `professionProgress` (INV-DERIVED:
 * nothing here is stored). The rank, the number added to the profession's rolls, is written large on the name line.
 * Challenges and the mission are diamonds, one per challenge needed; practice weeks over nine are tally marks in
 * fives. Each counter row is one 44 px button that dispatches one `profession:*` progress action, so undo and history
 * work as for any sheet change. `canEdit` false shows the same marks without controls.
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

  const left: string[] = []
  if (!p.highest) {
    const challenges = p.challengesNeeded - profession.challenges
    const weeks = p.practiceNeeded - profession.practiceWeeks
    if (challenges > 0) left.push(plural(challenges, 'challenge', 'challenges'))
    if (p.missionRequired && !missionDone) left.push('the mission')
    if (weeks > 0) left.push(plural(weeks, 'week', 'weeks'))
  }

  return (
    <li className="flex flex-col border-b border-border pb-3 last:border-b-0">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <h3 className="font-serif text-[19px] leading-6 font-semibold">{name}</h3>
        <span className="inline-flex items-baseline gap-1.5" aria-label={`Rank ${p.rank}, added to ${name} rolls`}>
          <small className="text-meta text-muted-foreground">rank</small>
          <span className="font-hand text-[30px] leading-none">+{p.rank}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-ui">
        <span>{rankLine(p.rank, p.rankName, p.nextRankName, p.highest)}</span>
        <span className="text-meta text-muted-foreground">Challenge CN ≥ {p.challengeCn}</span>
      </div>
      {profession.rerollOnes && <p className="text-meta text-muted-foreground">Wisdom of Experience: reroll 1s</p>}

      {p.highest ? (
        <p className="min-h-11 content-center text-ui font-medium">Highest rank</p>
      ) : (
        <>
          <dl className="mt-1 flex flex-col text-ui">
            <Counter label="Challenges">
              <Marks
                needed={p.challengesNeeded}
                done={profession.challenges}
                count={`${profession.challenges} / ${p.challengesNeeded}`}
                label={`Add a challenge to ${name}`}
                onMark={canEdit ? () => void dispatch({ kind: 'profession:challenge', professionId }) : undefined}
              />
            </Counter>
            <Counter label="Mission">
              {p.missionRequired ? (
                <Marks
                  needed={1}
                  done={missionDone ? 1 : 0}
                  count={missionDone ? 'done' : 'required'}
                  label={`Mission done for ${name}`}
                  checked={missionDone}
                  onMark={canEdit ? () => void dispatch({ kind: 'profession:mission', professionId, done: !missionDone }) : undefined}
                />
              ) : (
                <span className="text-meta text-muted-foreground">not required</span>
              )}
            </Counter>
            <Counter label="Practice">
              <Marks
                needed={p.practiceNeeded}
                done={profession.practiceWeeks}
                count={`${profession.practiceWeeks} / ${p.practiceNeeded} weeks`}
                label={`Add a week of practice to ${name}`}
                onMark={canEdit ? () => void dispatch({ kind: 'profession:practice', professionId }) : undefined}
              />
            </Counter>
          </dl>
          {canEdit && (
            <div className="mt-1.5 flex items-center justify-end gap-3">
              <span className="mr-auto text-meta text-muted-foreground">{stillOwed(left)}</span>
              <Button size="compact" variant="line-primary" type="button" disabled={!p.canAdvance} onClick={() => void dispatch({ kind: 'profession:advance', professionId })}>
                Advance to rank {p.rank + 1}
              </Button>
            </div>
          )}
        </>
      )}
    </li>
  )
}

function Counter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <dt className="flex-none text-muted-foreground">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  )
}

/**
 * A counter's marks and its count. Up to nine marks are diamonds — filled for each one done, the next one dashed;
 * more are tally marks in fives, the fifth struck across the other four. Counts past the number needed still show
 * (extra challenges shorten practice). With `onMark` the whole row is one 44 px button that adds the next mark.
 */
function Marks({
  needed,
  done,
  count,
  label,
  checked,
  onMark,
}: {
  needed: number
  done: number
  count: string
  label: string
  checked?: boolean
  onMark?: () => void
}) {
  const shown = Math.max(needed, done)
  const marks =
    shown > 9 ? (
      <Tally done={done} />
    ) : (
      Array.from({ length: shown }, (_, i) => <Diamond key={i} on={i < done} next={i === done} />)
    )
  const body = (
    <>
      <span className="inline-flex items-center gap-0.5">{marks}</span>
      <span className="ml-2 min-w-[38px] text-right font-hand text-[15px] whitespace-nowrap text-muted-foreground">{count}</span>
    </>
  )
  if (!onMark) return <span className="inline-flex min-h-11 items-center">{body}</span>
  return (
    <button
      type="button"
      aria-label={label}
      {...(checked === undefined ? {} : { role: 'checkbox', 'aria-checked': checked })}
      onClick={onMark}
      className="-mx-1.5 inline-flex min-h-11 items-center rounded-sm px-1.5 hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {body}
    </button>
  )
}

function Diamond({ on, next }: { on: boolean; next: boolean }) {
  return (
    <span className={`ink-mark${on ? ' on' : ''}${next ? ' next' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 16 16" width={15} height={15}>
        <path className="ol" d="M8 1.6 14.4 8 8 14.4 1.6 8Z" />
        <path className="fl" d="M8 4 12 8 8 12 4 8Z" />
      </svg>
    </span>
  )
}

function Tally({ done }: { done: number }) {
  if (done === 0) return <span className="text-meta text-muted-foreground">none yet</span>
  const groups = Array.from({ length: Math.ceil(done / 5) }, (_, g) => {
    const strokes = Math.min(5, done - g * 5)
    return (
      <svg key={g} width={20} height={18} viewBox="0 0 20 18">
        {Array.from({ length: strokes }, (_, k) =>
          k < 4 ? <path key={k} pathLength={100} d={`M${2 + k * 5} 2.5 L${2.6 + k * 5} 15.5`} /> : <path key={k} pathLength={100} d="M-1 12.5 L19.5 4" />,
        )}
      </svg>
    )
  })
  return (
    <span className="tally" aria-hidden="true">
      {groups}
    </span>
  )
}
