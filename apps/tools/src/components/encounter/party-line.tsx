import { useEffect, useRef, useState } from 'react'
import { Input } from '@heartrush/ui/components/input'
import { cn } from '@heartrush/ui/lib/utils'
import { DEFAULT_PARTY, partySchema, type Party } from '~/encounter/schema'
import { api, ApiError } from './api'

type Draft = { characters: string; bloodmarks: string; note: string }
const toDraft = (p: Party): Draft => ({ characters: String(p.characters), bloodmarks: String(p.bloodmarks), note: p.note })
const fromDraft = (d: Draft) =>
  partySchema.safeParse({ characters: Number(d.characters), bloodmarks: Number(d.bloodmarks), note: d.note.trim() })

/**
 * The GM's remembered party: number of characters, bloodmarks and a free-text note. Edited inline and saved when a
 * field loses focus. Every run receives it; the chat never asks for it.
 */
export function PartyLine({ onSignIn }: { onSignIn?: () => void }) {
  const [saved, setSaved] = useState<Party | null>(null)
  const [draft, setDraft] = useState<Draft>(toDraft(DEFAULT_PARTY))
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string }>({ kind: 'idle' })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    api
      .party()
      .then((p) => {
        setSaved(p)
        setDraft(toDraft(p))
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.signIn) onSignIn?.()
        setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Could not load the party' })
      })
  }, [onSignIn])

  const parsed = fromDraft(draft)
  const invalid = !parsed.success

  async function save() {
    if (!saved || !parsed.success) {
      if (!parsed.success) setStatus({ kind: 'error', text: 'Characters must be 1–10 and bloodmarks 0–50.' })
      return
    }
    const next = parsed.data
    if (next.characters === saved.characters && next.bloodmarks === saved.bloodmarks && next.note === saved.note) return
    setStatus({ kind: 'saving' })
    try {
      const stored = await api.saveParty(next)
      setSaved(stored)
      setStatus({ kind: 'saved' })
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setStatus({ kind: 'idle' }), 2000)
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save the party' })
    }
  }

  const number = 'h-9 w-16 px-2 text-center tabular-nums'
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
            disabled={!saved}
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
            disabled={!saved}
          />
          bloodmarks
        </label>
        <label className="flex min-w-0 flex-[1_1_14rem] items-center gap-2 text-ui">
          <span className="sr-only">Party note</span>
          <Input
            value={draft.note}
            maxLength={500}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="Note, e.g. “two healers, nobody ranged”"
            className="h-9"
            disabled={!saved}
          />
        </label>
        <button type="submit" hidden tabIndex={-1} />
        <p
          role="status"
          className={cn(
            'w-full text-meta',
            status.kind === 'error' || invalid ? 'text-warning' : 'text-muted-foreground',
            status.kind === 'idle' && !invalid && 'sr-only',
          )}
        >
          {invalid
            ? 'Characters must be 1–10 and bloodmarks 0–50.'
            : status.kind === 'saving'
              ? 'Saving…'
              : status.kind === 'saved'
                ? 'Saved. Every encounter uses this party.'
                : status.kind === 'error'
                  ? status.text
                  : 'Every encounter uses this party.'}
        </p>
      </form>
    </section>
  )
}
