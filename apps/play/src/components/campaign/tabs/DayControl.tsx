import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { MAX_DAY, setDayFn, type SetDayInput } from '~/server/campaign-play'
import type { CampaignDetail } from '~/server/campaigns'
import { campaignWrite } from '../write'

/**
 * The campaign header's day (spec §2.1). P2 mounts it beside the campaign name on `/campaigns/$id`. Everyone sees
 * "Day N"; the GM also gets **+1 day**, **+7 days** and **Set day**, which expands in place into a number field with
 * **Set** and **Cancel** (no dialog). `setDayFn` publishes a campaign event, so every open page of the campaign refetches
 * and `campaign.currentDay` arrives already updated.
 */
export type DayControlProps = {
  /** The campaign as the page's loader returned it: `currentDay`, and `role` (the viewer's) for the GM-only controls. */
  campaign: CampaignDetail
}

export function DayControl({ campaign }: DayControlProps) {
  const day = <span className="font-sans text-control font-semibold tabular-nums">Day {campaign.currentDay}</span>
  if (campaign.role !== 'gm') return day
  return <GmDayControl campaign={campaign}>{day}</GmDayControl>
}

function GmDayControl({ campaign, children }: DayControlProps & { children: ReactNode }) {
  const setDay = useServerFn(setDayFn)
  const router = useRouter()
  const id = useId()
  const [setting, setSetting] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const value = /^\d+$/.test(text) ? Number(text) : 0
  const valid = value >= 1 && value <= MAX_DAY

  const write = async (day: SetDayInput) => {
    setBusy(true)
    setError(null)
    const result = await campaignWrite('change the day', () => setDay({ data: { campaignId: campaign.id, ...day } }))
    setBusy(false)
    if (!result.ok) return setError(result.text)
    setSetting(false)
    void router.invalidate()
  }
  const open = () => {
    setText(String(campaign.currentDay))
    setError(null)
    setSetting(true)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!busy && valid) void write({ set: value })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
        {setting ? (
          <form onSubmit={submit} className="flex items-center gap-2">
            <label htmlFor={id} className="sr-only">
              Day
            </label>
            <Input
              id={id}
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={text}
              aria-invalid={text !== '' && !valid}
              onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Escape' && setSetting(false)}
              className="h-11 w-24 text-center tabular-nums"
            />
            <Button size="compact" variant="line-primary" type="submit" disabled={busy || !valid}>
              Set
            </Button>
            <Button size="compact" type="button" variant="ghost" onClick={() => setSetting(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <Button size="compact" type="button" variant="line" disabled={busy} onClick={() => void write({ add: 1 })}>
              +1 day
            </Button>
            <Button size="compact" type="button" variant="line" disabled={busy} onClick={() => void write({ add: 7 })}>
              +7 days
            </Button>
            <Button size="compact" type="button" variant="ghost" disabled={busy} onClick={open}>
              Set day
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-ui text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  )
}
