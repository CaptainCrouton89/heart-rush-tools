import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { cn } from '@heartrush/ui/lib/utils'
import { campaignWrite } from '~/components/campaign/write'
import type { CampaignCharacterCard } from '~/server/campaigns'
import { listStratagemsFn, updateStratagemFn, type CreateStratagemInput, type ObjectiveState, type StratagemView } from '~/server/campaign-play'
import { objectiveInputs, objectiveLabel, objectiveTitle, STATE_LABEL, STATUS_LABEL } from './model'
import { ObjectiveRoll } from './ObjectiveRoll'
import { StratagemForm } from './StratagemForm'

const FIELD_KEYS = ['goal', 'timePerRoll', 'setupCn', 'status', 'objectives', 'assets'] as const
const FIELD_LABEL: Record<(typeof FIELD_KEYS)[number], string> = { goal: 'goal', timePerRoll: 'time per roll', setupCn: 'setup CN', status: 'status', objectives: 'objectives', assets: 'assets and hindrances' }
const fieldsOf = (s: StratagemView): Required<CreateStratagemInput> => ({ goal: s.goal, timePerRoll: s.timePerRoll, setupCn: s.setupCn, status: s.status, objectives: objectiveInputs(s), assets: s.assets })
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

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
  const list = useServerFn(listStratagemsFn)
  const router = useRouter()
  // The fields as they were when the GM opened the form; null while the card shows.
  const [opened, setOpened] = useState<Required<CreateStratagemInput> | null>(null)
  const [busy, setBusy] = useState(false)
  const [line, setLine] = useState<string | null>(null)

  // The stratagem as stored now, read just before a write so the write starts from the current fields, not this page's
  // last fetch (another tab of the GM may have changed them since).
  const current = async (): Promise<StratagemView | string> => {
    const r = await campaignWrite('read the stratagem', () => list({ data: { campaignId } }))
    if (!r.ok) return r.text
    return r.value.stratagems.find((x) => x.id === s.id) ?? "Couldn't change the stratagem: it no longer exists."
  }

  const setState = async (index: number, state: ObjectiveState) => {
    setBusy(true)
    setLine(null)
    const text = await (async () => {
      const now = await current()
      if (typeof now === 'string') return now
      const clicked = s.objectives[index]
      const there = now.objectives[index]
      if (!there || there.title !== clicked.title || there.leaderCharacterId !== clicked.leaderCharacterId)
        return "Couldn't change the objective: the objectives changed since this page loaded. Check the list and try again."
      const objectives = objectiveInputs(now).map((o, i) => (i === index ? { ...o, state } : o))
      const result = await campaignWrite('change the objective', () => update({ data: { campaignId, stratagemId: s.id, objectives, expectedRevision: now.revision } }))
      return result.ok ? null : result.text
    })()
    setBusy(false)
    setLine(text)
    void router.invalidate()
  }

  if (opened) {
    return (
      <StratagemForm
        initial={opened}
        characters={characters}
        saveLabel="Save"
        onCancel={() => setOpened(null)}
        onSave={async (fields) => {
          // Write only what the GM changed, and refuse when one of those fields was changed elsewhere (the GM's other tab)
          // since the form opened: a field the GM did not touch is never overwritten, and a field they did is never lost.
          const keys = FIELD_KEYS.filter((k) => !same(fields[k], opened[k]))
          const fresh = keys.length > 0 ? await current() : s
          if (typeof fresh === 'string') return fresh
          const now = fieldsOf(fresh)
          const clash = keys.filter((k) => !same(now[k], opened[k]))
          if (clash.length > 0) return `The ${clash.map((k) => FIELD_LABEL[k]).join(' and ')} changed since you opened the form. Cancel and edit again to see the change.`
          if (keys.length > 0) {
            const patch = Object.fromEntries(keys.map((k) => [k, fields[k]]))
            const result = await campaignWrite('save the stratagem', () => update({ data: { campaignId, stratagemId: s.id, expectedRevision: fresh.revision, ...patch } }))
            if (!result.ok) return result.text
          }
          setOpened(null)
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
            <Button size="compact" type="button" variant="line" onClick={() => setOpened(fieldsOf(s))}>
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
                // Keyed by what the roll panel shows and who may roll, not the index alone: when the GM removes, renames or
                // reassigns the objective at this index, an open roll panel closes instead of rolling the new occupant under the old label.
                <li key={`${i}:${objectiveLabel(s.goal, o.title)}:${o.leaderCharacterId ?? ''}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2 last:border-b-0">
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
                          <Button size="compact" type="button" variant="line" disabled={busy} aria-label={`Mark ${title} done`} onClick={() => void setState(i, 'done')}>
                            Done
                          </Button>
                          <Button size="compact" type="button" variant="ghost" disabled={busy} aria-label={`Mark ${title} gone`} onClick={() => void setState(i, 'gone')}>
                            Gone
                          </Button>
                        </>
                      ) : (
                        <Button size="compact" type="button" variant="ghost" disabled={busy} aria-label={`Reopen ${title}`} onClick={() => void setState(i, 'open')}>
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
