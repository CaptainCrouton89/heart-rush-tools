import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { ToggleGroup, ToggleGroupItem } from '@heartrush/ui/components/toggle-group'
import { cn } from '@heartrush/ui/lib/utils'
import type { CampaignCharacterCard } from '~/server/campaigns'
import {
  MAX_ASSETS,
  MAX_CN,
  MAX_OBJECTIVES,
  MAX_TEXT_LENGTH,
  type AssetInput,
  type AssetKind,
  type CreateStratagemInput,
  type ObjectiveInput,
  type ObjectiveState,
  type StratagemStatus,
} from '~/server/campaign-play'
import { KIND_LABEL, STATE_LABEL, STATUS_LABEL } from './model'

/** Every field of a stratagem as the form holds it: numbers as typed text until **Save**. */
type Draft = {
  goal: string
  timePerRoll: string
  setupCn: string
  status: StratagemStatus
  objectives: { title: string; cn: string; leaderCharacterId: string | null; state: ObjectiveState }[]
  assets: AssetInput[]
}

export type StratagemFormProps = {
  /** The stratagem's current fields; absent for a new stratagem. */
  initial?: Required<CreateStratagemInput>
  /** The campaign's characters, the choices for an objective's leader. */
  characters: CampaignCharacterCard[]
  saveLabel: string
  /** Writes the fields; resolves to the line to show when the write did not go through, or null when it did. */
  onSave: (fields: Required<CreateStratagemInput>) => Promise<string | null>
  onCancel: () => void
}

const selectClass = 'h-11 w-full rounded-md border border-input bg-surface px-3 font-sans text-base text-foreground md:text-ui'

/** A whole number typed in a field ("−3" with either minus sign); null for blank; undefined when it is not a number. */
function parseWhole(text: string): number | null | undefined {
  const t = text.trim().replace('−', '-')
  if (t === '') return null
  return /^-?\d+$/.test(t) && Math.abs(Number(t)) <= MAX_CN ? Number(t) : undefined
}

const keepNumberChars = (text: string) => text.replace(/[^\d\-−]/g, '').slice(0, 5)

function toDraft(initial: Required<CreateStratagemInput> | undefined): Draft {
  if (!initial) return { goal: '', timePerRoll: '', setupCn: '', status: 'active', objectives: [], assets: [] }
  return {
    goal: initial.goal,
    timePerRoll: initial.timePerRoll,
    setupCn: String(initial.setupCn),
    status: initial.status,
    objectives: initial.objectives.map((o) => ({ ...o, cn: o.cn === null ? '' : String(o.cn) })),
    assets: initial.assets,
  }
}

/**
 * The GM's form for every field of a stratagem (spec §2.3): goal, time per roll, setup CN, status, the ordered objectives
 * (title — blank is an unrevealed slot — own CN, leader, open / done / gone) and the assets and hindrances. It opens in
 * place of the card or the **New stratagem** button; the server checks the GM role on every write.
 */
export function StratagemForm({ initial, characters, saveLabel, onSave, onCancel }: StratagemFormProps) {
  const ids = useId()
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setObjective = (i: number, patch: Partial<Draft['objectives'][number]>) =>
    setDraft((d) => ({ ...d, objectives: d.objectives.map((o, j) => (j === i ? { ...o, ...patch } : o)) }))
  const setAsset = (i: number, patch: Partial<AssetInput>) => setDraft((d) => ({ ...d, assets: d.assets.map((a, j) => (j === i ? { ...a, ...patch } : a)) }))

  const setupCn = parseWhole(draft.setupCn)
  const objectiveCns = draft.objectives.map((o) => parseWhole(o.cn))
  const problem =
    !draft.goal.trim() ? 'The goal is required.'
    : setupCn === null || setupCn === undefined ? 'The setup CN must be a whole number.'
    : objectiveCns.some((cn) => cn === undefined) ? "An objective's CN must be a whole number, or blank for the setup CN."
    : draft.assets.some((a) => !a.name.trim()) ? 'Every asset and hindrance needs a name.'
    : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || problem !== null || setupCn == null) return
    setBusy(true)
    setError(null)
    const line = await onSave({
      goal: draft.goal.trim(),
      timePerRoll: draft.timePerRoll.trim(),
      setupCn,
      status: draft.status,
      objectives: draft.objectives.map((o, i): ObjectiveInput => ({ title: o.title.trim(), cn: objectiveCns[i] ?? null, leaderCharacterId: o.leaderCharacterId, state: o.state })),
      assets: draft.assets.map((a) => ({ name: a.name.trim(), kind: a.kind })),
    })
    setBusy(false)
    setError(line)
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      onKeyDown={(e) => e.key === 'Escape' && !busy && onCancel()}
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_6rem]">
        <Field label="Goal" htmlFor={`${ids}-goal`}>
          <Input id={`${ids}-goal`} autoFocus value={draft.goal} maxLength={MAX_TEXT_LENGTH} placeholder="Take Thornwall" onChange={(e) => set({ goal: e.target.value })} className="h-11" />
        </Field>
        <Field label="Time per roll" htmlFor={`${ids}-time`}>
          <Input id={`${ids}-time`} value={draft.timePerRoll} maxLength={MAX_TEXT_LENGTH} placeholder="1 week" onChange={(e) => set({ timePerRoll: e.target.value })} className="h-11" />
        </Field>
        <Field label="Setup CN" htmlFor={`${ids}-cn`}>
          <Input
            id={`${ids}-cn`}
            inputMode="numeric"
            autoComplete="off"
            value={draft.setupCn}
            aria-invalid={draft.setupCn !== '' && setupCn === undefined ? true : undefined}
            onChange={(e) => set({ setupCn: keepNumberChars(e.target.value) })}
            className="h-11 text-center tabular-nums"
          />
        </Field>
      </div>

      <Field label="Status">
        <ToggleGroup type="single" value={draft.status} onValueChange={(v) => v && set({ status: v as StratagemStatus })} aria-label="Status">
          {(Object.keys(STATUS_LABEL) as StratagemStatus[]).map((s) => (
            <ToggleGroupItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="eyebrow mb-2 text-muted-foreground">Objectives</legend>
        {draft.objectives.length === 0 && <p className="text-ui text-muted-foreground">No objectives yet.</p>}
        <ol className="flex flex-col gap-2">
          {draft.objectives.map((o, i) => {
            const n = i + 1
            return (
              <li key={i} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={`Objective ${n}`} htmlFor={`${ids}-o${i}-title`} className="min-w-0 flex-1 basis-56">
                    <Input
                      id={`${ids}-o${i}-title`}
                      value={o.title}
                      maxLength={MAX_TEXT_LENGTH}
                      placeholder="Unknown objective"
                      onChange={(e) => setObjective(i, { title: e.target.value })}
                      className="h-11"
                    />
                  </Field>
                  <Field label="Own CN" htmlFor={`${ids}-o${i}-cn`} className="w-24">
                    <Input
                      id={`${ids}-o${i}-cn`}
                      inputMode="numeric"
                      autoComplete="off"
                      value={o.cn}
                      placeholder={draft.setupCn || 'setup'}
                      aria-invalid={objectiveCns[i] === undefined ? true : undefined}
                      onChange={(e) => setObjective(i, { cn: keepNumberChars(e.target.value) })}
                      className="h-11 text-center tabular-nums"
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Leader" htmlFor={`${ids}-o${i}-leader`} className="min-w-0 flex-1 basis-48">
                    <select
                      id={`${ids}-o${i}-leader`}
                      className={selectClass}
                      value={o.leaderCharacterId ?? ''}
                      onChange={(e) => setObjective(i, { leaderCharacterId: e.target.value || null })}
                    >
                      <option value="">No leader</option>
                      {characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || 'Unnamed character'} ({c.ownerName})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <ToggleGroup type="single" value={o.state} onValueChange={(v) => v && setObjective(i, { state: v as ObjectiveState })} aria-label={`Objective ${n} state`}>
                    {(Object.keys(STATE_LABEL) as ObjectiveState[]).map((s) => (
                      <ToggleGroupItem key={s} value={s}>
                        {STATE_LABEL[s]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    aria-label={`Remove objective ${n}`}
                    onClick={() => set({ objectives: draft.objectives.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="self-start"
          disabled={draft.objectives.length >= MAX_OBJECTIVES}
          onClick={() => set({ objectives: [...draft.objectives, { title: '', cn: '', leaderCharacterId: null, state: 'open' }] })}
        >
          Add objective
        </Button>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="eyebrow mb-2 text-muted-foreground">Assets and hindrances</legend>
        {draft.assets.length === 0 && <p className="text-ui text-muted-foreground">None. Each asset lowers every objective's CN by 3; each hindrance raises it by 3.</p>}
        <ul className="flex flex-col gap-2">
          {draft.assets.map((a, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <label htmlFor={`${ids}-a${i}`} className="sr-only">
                Name of {KIND_LABEL[a.kind].toLowerCase()} {i + 1}
              </label>
              <Input
                id={`${ids}-a${i}`}
                value={a.name}
                maxLength={MAX_TEXT_LENGTH}
                placeholder={a.kind === 'asset' ? 'Siege engines' : 'Winter storms'}
                onChange={(e) => setAsset(i, { name: e.target.value })}
                className="h-11 min-w-0 flex-1 basis-48"
              />
              <ToggleGroup type="single" value={a.kind} onValueChange={(v) => v && setAsset(i, { kind: v as AssetKind })} aria-label={`Kind of item ${i + 1}`}>
                {(Object.keys(KIND_LABEL) as AssetKind[]).map((k) => (
                  <ToggleGroupItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Button type="button" variant="ghost" size="lg" aria-label={`Remove ${a.name.trim() || `item ${i + 1}`}`} onClick={() => set({ assets: draft.assets.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="lg" disabled={draft.assets.length >= MAX_ASSETS} onClick={() => set({ assets: [...draft.assets, { name: '', kind: 'asset' }] })}>
            Add asset
          </Button>
          <Button type="button" variant="outline" size="lg" disabled={draft.assets.length >= MAX_ASSETS} onClick={() => set({ assets: [...draft.assets, { name: '', kind: 'hindrance' }] })}>
            Add hindrance
          </Button>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="submit" size="lg" disabled={busy || problem !== null}>
          {busy ? 'Saving…' : saveLabel}
        </Button>
        <Button type="button" size="lg" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        {problem !== null && <p className="text-ui text-muted-foreground">{problem}</p>}
      </div>
      {error && (
        <p role="alert" className="text-ui text-primary">
          {error}
        </p>
      )}
    </form>
  )
}

/** A labelled control: `htmlFor` labels one input; without it the block is a group named by the label. */
function Field({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: ReactNode }) {
  const id = useId()
  return htmlFor ? (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="eyebrow text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  ) : (
    <div role="group" aria-labelledby={id} className={cn('flex flex-col gap-1.5', className)}>
      <span id={id} className="eyebrow text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}
