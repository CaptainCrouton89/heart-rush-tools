import { useEffect, useState } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Popover, PopoverContent, PopoverTrigger } from '@heartrush/ui/components/popover'
import { cn } from '@heartrush/ui/lib/utils'
import { api, type CampaignSession, type Campaigns } from './api'

export type CampaignList = { id: string; name: string }[]

/**
 * The GM's campaigns on play.heartrush.party. `unavailable` while tools has no `PLAY` binding (both campaign controls hidden);
 * `failed` when play could not be read, which the party line reports and Add to campaign hides itself for.
 */
export type CampaignsState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; campaigns: CampaignList; current: string | null }

/** Loads once `enabled` (signed in). */
export function useCampaigns(enabled = true): CampaignsState {
  const [state, setState] = useState<CampaignsState>({ kind: 'loading' })
  useEffect(() => {
    if (!enabled) return
    let live = true
    api
      .campaigns()
      .then((c: Campaigns) => {
        if (live) setState(c.available ? { kind: 'ready', campaigns: c.campaigns, current: c.current } : { kind: 'unavailable' })
      })
      .catch((e: unknown) => {
        if (live) setState({ kind: 'failed', message: e instanceof Error ? e.message : 'Could not load your campaigns' })
      })
    return () => {
      live = false
    }
  }, [enabled])
  return state
}

const SELECT =
  'h-11 min-w-0 max-w-full rounded-md border border-input bg-surface px-2 font-sans text-base text-foreground disabled:opacity-50 md:h-9 md:text-ui'

/** The party a run reads: the typed party line, or one of the GM's campaigns on play.heartrush.party. */
export function PartySourceSelect({
  id,
  campaigns,
  value,
  onChange,
  disabled,
  className,
}: {
  id: string
  campaigns: CampaignList
  value: string | null
  onChange: (campaignId: string | null) => void
  disabled?: boolean
  className?: string
}) {
  // A stored campaign that play no longer lists for this GM, or could not be read, stays listed, so the select shows what the encounter really holds.
  const known = value === null || campaigns.some((c) => c.id === value)
  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className={cn(SELECT, className)}
    >
      <option value="">Typed party</option>
      {campaigns.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      {!known && <option value={value}>Campaign unavailable</option>}
    </select>
  )
}

/** The open session, else the newest. */
const defaultSession = (sessions: CampaignSession[]) =>
  sessions.find((s) => s.open) ?? sessions.reduce<CampaignSession | undefined>((a, s) => (!a || s.number > a.number ? s : a), undefined)

const sessionLabel = (s: CampaignSession) => `Session ${s.number}${s.open ? ' (open)' : ''}`

/**
 * Add to campaign (spec §7.3): attach this finished encounter to a session on play.heartrush.party. Shown only when the GM has a
 * campaign. A refusal or failure from play shows in the panel; the page is unaffected.
 */
export function AddToCampaign({
  encounterId,
  campaigns,
  preferred,
}: {
  encounterId: string
  campaigns: CampaignList
  /** The encounter's own campaign, chosen first when it is in the list. */
  preferred: string | null
}) {
  const [open, setOpen] = useState(false)
  const [campaignId, setCampaignId] = useState(() => campaigns.find((c) => c.id === preferred)?.id ?? campaigns[0].id)
  const [sessions, setSessions] = useState<CampaignSession[] | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [status, setStatus] = useState<{ kind: 'idle' | 'adding' | 'added' | 'error'; text?: string }>({ kind: 'idle' })

  useEffect(() => {
    if (!open) return
    let live = true
    setSessions(null)
    setStatus({ kind: 'idle' })
    api
      .sessions(campaignId)
      .then((list) => {
        if (!live) return
        setSessions(list)
        setSessionId(defaultSession(list)?.id ?? '')
      })
      .catch((e: unknown) => {
        if (!live) return
        setSessions([])
        setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Could not load the sessions' })
      })
    return () => {
      live = false
    }
  }, [open, campaignId])

  async function add() {
    setStatus({ kind: 'adding' })
    try {
      await api.attach(encounterId, campaignId, sessionId)
      const session = sessions?.find((s) => s.id === sessionId)
      const campaign = campaigns.find((c) => c.id === campaignId)
      setStatus({ kind: 'added', text: `Added to ${session ? `session ${session.number}` : 'the session'} of ${campaign?.name ?? 'the campaign'}.` })
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Could not add the encounter' })
    }
  }

  const loadingSessions = sessions === null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Add to campaign
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2.5rem)] space-y-3">
        <p className="font-serif text-body-sm text-foreground">Link this encounter from a session on play.heartrush.party.</p>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          Campaign
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            disabled={status.kind === 'adding'}
            className={SELECT}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-meta text-muted-foreground">
          Session
          <select
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value)
              setStatus({ kind: 'idle' })
            }}
            disabled={loadingSessions || !sessions.length || status.kind === 'adding'}
            className={SELECT}
          >
            {loadingSessions && <option value="">Loading…</option>}
            {sessions?.length === 0 && <option value="">No sessions yet</option>}
            {sessions?.map((s) => (
              <option key={s.id} value={s.id}>
                {sessionLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            onClick={() => void add()}
            disabled={!sessionId || loadingSessions || status.kind === 'adding' || status.kind === 'added'}
          >
            {status.kind === 'adding' ? 'Adding…' : status.kind === 'added' ? 'Added' : 'Add'}
          </Button>
        </div>
        {sessions?.length === 0 && status.kind !== 'error' && (
          <p className="text-meta text-muted-foreground">Start a session for this campaign on play.heartrush.party first.</p>
        )}
        {(status.kind === 'added' || status.kind === 'error') && (
          <p role="status" className={cn('text-meta', status.kind === 'error' ? 'text-warning' : 'text-muted-foreground')}>
            {status.text}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
