import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Input } from '@heartrush/ui/components/input'
import { cn } from '@heartrush/ui/lib/utils'
import { DEFAULT_PARTY, partySchema, type Party } from '~/encounter/schema'
import { api, ApiError } from './api'
import { PartySourceSelect, type CampaignsState } from './campaigns'

type Draft = { characters: string; bloodmarks: string; note: string }
const toDraft = (p: Party): Draft => ({ characters: String(p.characters), bloodmarks: String(p.bloodmarks), note: p.note })
const fromDraft = (d: Draft) =>
  partySchema.safeParse({ characters: Number(d.characters), bloodmarks: Number(d.bloodmarks), note: d.note.trim() })

export type PartyLineHandle = { save: () => Promise<boolean> }

/**
 * The GM's remembered party: number of characters, bloodmarks and a free-text note. Edited inline and saved when a
 * field loses focus. Every run receives it; the chat never asks for it. When the GM has campaigns on play.heartrush.party, a
 * picker beside it chooses the new encounter's party: a campaign's characters replace the typed numbers (the note still applies).
 */
export function PartyLine({
  ref,
  onSignIn,
  campaigns,
  campaignId,
  onCampaignChange,
}: {
  ref?: Ref<PartyLineHandle>
  onSignIn?: () => void
  campaigns: CampaignsState
  campaignId: string | null
  onCampaignChange: (campaignId: string | null) => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState<Draft>(toDraft(DEFAULT_PARTY))
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string }>({ kind: 'idle' })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  /** The party the server holds, as last loaded or saved. */
  const saved = useRef<Party | null>(null)
  /** Saves run one after another, so a save always compares against what the one before it stored. */
  const queue = useRef<Promise<boolean>>(Promise.resolve(true))

  useEffect(() => {
    api
      .party()
      .then((p) => {
        saved.current = p
        setLoaded(true)
        setDraft(toDraft(p))
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.signIn) onSignIn?.()
        setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Could not load the party' })
      })
  }, [onSignIn])

  const campaignList = campaigns.kind === 'ready' ? campaigns.campaigns : []
  const campaign = campaignList.find((c) => c.id === campaignId) ?? null
  // With a campaign chosen the typed numbers are hidden and unused, so only the note is checked and saved.
  const parsed = fromDraft(campaign && saved.current ? { ...toDraft(saved.current), note: draft.note } : draft)
  const invalid = !parsed.success

  /** Save the values on screen. Resolves true once the server holds them, false when they are invalid or the save failed. */
  function save(): Promise<boolean> {
    if (!parsed.success) {
      setStatus({ kind: 'error', text: 'Characters must be 1–10 and bloodmarks 0–50.' })
      return Promise.resolve(false)
    }
    const next = parsed.data
    queue.current = queue.current.then(async () => {
      const prev = saved.current
      if (!prev) return false // never loaded: the load error is already shown
      if (next.characters === prev.characters && next.bloodmarks === prev.bloodmarks && next.note === prev.note) return true
      setStatus({ kind: 'saving' })
      try {
        saved.current = await api.saveParty(next)
        setStatus({ kind: 'saved' })
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setStatus({ kind: 'idle' }), 2000)
        return true
      } catch (e) {
        setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save the party' })
        return false
      }
    })
    return queue.current
  }
  useImperativeHandle(ref, () => ({ save }))

  const number = 'h-9 w-16 px-2 text-center tabular-nums'
  const idle = campaign
    ? `${campaign.name}’s characters are read from play.heartrush.party when each run starts.`
    : 'Every encounter uses this party.'
  return (
    <section aria-labelledby="party-heading" className="border-y border-border py-3">
      <form
        className="flex flex-wrap items-center gap-x-4 gap-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        onBlur={(e) => {
          // Save once focus leaves the whole row, not when it moves between its own fields.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void save()
        }}
      >
        <h2 id="party-heading" className="eyebrow mr-1 w-full sm:w-auto">
          Your party
        </h2>
        {campaignList.length > 0 && (
          <>
            <label htmlFor="party-source" className="sr-only">
              Party for the new encounter
            </label>
            <PartySourceSelect id="party-source" campaigns={campaignList} value={campaignId} onChange={onCampaignChange} />
          </>
        )}
        {!campaign && (
          <>
        <label className="flex items-center gap-2 text-ui">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={draft.characters}
            onChange={(e) => setDraft({ ...draft, characters: e.target.value })}
            className={number}
            aria-invalid={!Number.isInteger(Number(draft.characters)) || Number(draft.characters) < 1 || Number(draft.characters) > 10}
            disabled={!loaded}
          />
          characters
        </label>
        <label className="flex items-center gap-2 text-ui">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            value={draft.bloodmarks}
            onChange={(e) => setDraft({ ...draft, bloodmarks: e.target.value })}
            className={number}
            aria-invalid={!Number.isInteger(Number(draft.bloodmarks)) || Number(draft.bloodmarks) < 0 || Number(draft.bloodmarks) > 50}
            disabled={!loaded}
          />
          bloodmarks
        </label>
          </>
        )}
        <label className="flex min-w-0 flex-[1_1_14rem] items-center gap-2 text-ui">
          <span className="sr-only">Party note</span>
          <Input
            value={draft.note}
            maxLength={500}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="Note, e.g. “two healers, nobody ranged”"
            className="h-9"
            disabled={!loaded}
          />
        </label>
        <button type="submit" hidden tabIndex={-1} />
        <p
          role="status"
          className={cn(
            'w-full text-meta',
            status.kind === 'error' || invalid || campaigns.kind === 'failed' ? 'text-warning' : 'text-muted-foreground',
          )}
        >
          {campaigns.kind === 'failed' && `${campaigns.message} `}
          {invalid
            ? 'Characters must be 1–10 and bloodmarks 0–50.'
            : status.kind === 'saving'
              ? 'Saving…'
              : status.kind === 'saved'
                ? `Saved. ${idle}`
                : status.kind === 'error'
                  ? status.text
                  : idle}
        </p>
      </form>
    </section>
  )
}
