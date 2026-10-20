import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { cn } from '@heartrush/ui/lib/utils'
import { campaignWrite } from '~/components/campaign/write'
import type { CampaignCharacterCard } from '~/server/campaigns'
import { updateStratagemFn, type ObjectiveState, type StratagemView } from '~/server/campaign-play'
import { objectiveInputs, objectiveLabel, objectiveTitle, STATE_LABEL, STATUS_LABEL } from './model'
import { ObjectiveRoll } from './ObjectiveRoll'
import { StratagemForm } from './StratagemForm'

export type StratagemCardProps = {
  campaignId: string
  stratagem: StratagemView
  /** The viewer is the campaign's GM: **Edit** and the done / gone / reopen buttons show. The server checks the role. */
  isGm: boolean
  /** The viewer's own characters in this campaign, by id: **Roll** shows on an open objective one of them leads. */
  mine: ReadonlySet<string>
  characters: CampaignCharacterCard[]
}

/**
 * One stratagem (spec §2.3): goal, time per roll, setup CN and status; its objectives in order with title (or "Unknown
 * objective"), the current CN on each open one, leader and state; then its assets and hindrances. The GM's **Edit** turns
 * the card into the form in place; the GM also marks an objective done or gone (or reopens it) from the list.
 */
export function StratagemCard({ campaignId, stratagem: s, isGm, mine, characters }: StratagemCardProps) {
  const update = useServerFn(updateStratagemFn)
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [line, setLine] = useState<string | null>(null)

  const setState = async (index: number, state: ObjectiveState) => {
    setBusy(true)
    setLine(null)
    const objectives = objectiveInputs(s).map((o, i) => (i === index ? { ...o, state } : o))
    const result = await campaignWrite('change the objective', () => update({ data: { campaignId, stratagemId: s.id, objectives } }))
    setBusy(false)
    if (!result.ok) return setLine(result.text)
    void router.invalidate()
  }

  if (editing) {
    return (
      <StratagemForm
        initial={{ goal: s.goal, timePerRoll: s.timePerRoll, setupCn: s.setupCn, status: s.status, objectives: objectiveInputs(s), assets: s.assets }}
        characters={characters}
        saveLabel="Save"
        onCancel={() => setEditing(false)}
        onSave={async (fields) => {
          const result = await campaignWrite('save the stratagem', () => update({ data: { campaignId, stratagemId: s.id, ...fields } }))
          if (!result.ok) return result.text
          setEditing(false)
          void router.invalidate()
          return null
        }}
      />
    )
  }

  const assets = s.assets.filter((a) => a.kind === 'asset')
  const hindrances = s.assets.filter((a) => a.kind === 'hindrance')

  return (
    <article aria-label={s.goal} className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-serif text-h4 font-semibold">{s.goal}</h3>
          <p className="text-ui text-muted-foreground">
            {s.timePerRoll ? `${s.timePerRoll} per roll` : 'No time per roll set'} · setup CN <span className="tabular-nums">{s.setupCn}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-sm border px-2 py-0.5 text-meta font-medium', s.status === 'active' ? 'border-primary text-primary' : 'border-border text-muted-foreground')}>
            {STATUS_LABEL[s.status]}
          </span>
          {isGm && (
            <Button type="button" variant="outline" size="lg" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-1">
        <h4 className="eyebrow border-b border-border pb-2">Objectives</h4>
        {s.objectives.length === 0 ? (
          <p className="text-ui text-muted-foreground">No objectives yet.</p>
        ) : (
          <ol className="flex flex-col">
            {s.objectives.map((o, i) => {
              const title = objectiveTitle(o.title)
              const leads = o.state === 'open' && o.leaderCharacterId !== null && mine.has(o.leaderCharacterId) && o.currentCn !== null
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2 last:border-b-0">
                  <div className="flex min-w-0 flex-1 basis-56 flex-col">
                    <span className={cn('text-body-sm', o.state === 'gone' && 'text-muted-foreground line-through', !o.title.trim() && 'italic')}>
                      <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {title}
                    </span>
                    <span className="text-ui text-muted-foreground">
                      {o.leaderName ?? 'No leader'} · {STATE_LABEL[o.state]}
                    </span>
                  </div>
                  {o.currentCn !== null && (
                    <span className="shrink-0 font-sans text-control font-semibold tabular-nums" aria-label={`Current CN ${o.currentCn}`}>
                      CN {o.currentCn}
                    </span>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {leads && <ObjectiveRoll characterId={o.leaderCharacterId!} stratagemId={s.id} index={i} label={objectiveLabel(s.goal, o.title)} cn={o.currentCn!} />}
                    {isGm &&
                      (o.state === 'open' ? (
                        <>
                          <Button type="button" variant="outline" size="lg" disabled={busy} aria-label={`Mark ${title} done`} onClick={() => void setState(i, 'done')}>
                            Done
                          </Button>
                          <Button type="button" variant="ghost" size="lg" disabled={busy} aria-label={`Mark ${title} gone`} onClick={() => void setState(i, 'gone')}>
                            Gone
                          </Button>
                        </>
                      ) : (
                        <Button type="button" variant="ghost" size="lg" disabled={busy} aria-label={`Reopen ${title}`} onClick={() => void setState(i, 'open')}>
                          Reopen
                        </Button>
                      ))}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        {line && (
          <p role="alert" className="text-ui text-primary">
            {line}
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <AssetList title="Assets" names={assets.map((a) => a.name)} effect="−3 CN each" />
        <AssetList title="Hindrances" names={hindrances.map((a) => a.name)} effect="+3 CN each" />
      </section>
    </article>
  )
}

function AssetList({ title, names, effect }: { title: string; names: string[]; effect: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="eyebrow border-b border-border pb-2">
        {title} {names.length > 0 && <span className="font-normal normal-case tracking-normal text-muted-foreground">· {effect}</span>}
      </h4>
      {names.length === 0 ? (
        <p className="text-ui text-muted-foreground">None</p>
      ) : (
        <ul className="flex flex-col">
          {names.map((n, i) => (
            <li key={i} className="text-ui">
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
