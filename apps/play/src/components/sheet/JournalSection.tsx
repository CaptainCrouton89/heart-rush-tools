import { useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import {
  createJournalEntryFn, deleteJournalEntryFn, editJournalEntryFn, listJournalFn, setJournalSharedFn,
  type JournalEntry, type JournalRefusal,
} from '~/server/journal'
import { JournalEditor } from '../journal/JournalEditor'
import { JournalEntryItem } from '../journal/JournalEntryItem'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

const sheetRoute = getRouteApi('/characters/$id')

const NO_CONNECTION = 'Not saved — no connection'
const FAILED = 'Not saved — something went wrong. Try again.'
const refusal = (r: JournalRefusal) => `Not saved: ${r.message}`

/** Sends one journal write and turns its outcome into an error text, or null after `onOk` took the result. */
async function attempt<R extends { ok: true }>(write: () => Promise<R | JournalRefusal>, onOk: (r: R) => void): Promise<string | null> {
  let result: R | JournalRefusal
  try {
    result = await write()
  } catch (e) {
    // fetch rejects with a TypeError when the request never reached the server; anything else is a server failure.
    console.error('journal write failed', e)
    return e instanceof TypeError ? NO_CONNECTION : FAILED
  }
  if (!result.ok) return refusal(result)
  onOk(result)
  return null
}

/**
 * The character's journal (campaign spec §6): the owner's private entries, newest first, with a new-entry form, edit,
 * delete and the **Share with campaign** switch. Only the character's owner sees it — not the GM who edits the sheet,
 * not another player — because the journal server answers its owner alone (INV-PRIVATE). Entries are not character
 * state: nothing here goes through `dispatch`, so no event, revision change or undo follows a write.
 */
export function JournalSection(_props: SectionProps) {
  const { id: characterId, role, campaignId } = sheetRoute.useLoaderData()
  if (role !== 'owner') return null
  return <Journal key={characterId} characterId={characterId} inCampaign={campaignId !== null} />
}

function Journal({ characterId, inCampaign }: { characterId: string; inCampaign: boolean }) {
  const list = useServerFn(listJournalFn)
  const create = useServerFn(createJournalEntryFn)
  const edit = useServerFn(editJournalEntryFn)
  const remove = useServerFn(deleteJournalEntryFn)
  const share = useServerFn(setJournalSharedFn)

  const [entries, setEntries] = useState<JournalEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)

  useEffect(() => {
    let current = true
    list({ data: { characterId } }).then(
      (r) => {
        if (!current) return
        if (r.ok) setEntries(r.entries)
        else setLoadError(`The journal could not be loaded: ${r.message}.`)
      },
      () => { if (current) setLoadError('The journal could not be loaded. Reload the page to try again.') },
    )
    return () => { current = false }
  }, [list, characterId])

  const replace = (entry: JournalEntry) => setEntries((all) => all?.map((e) => (e.id === entry.id ? entry : e)) ?? all)

  return (
    <Section
      title="Journal"
      action={
        !writing && entries && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setWriting(true)}>
            New entry
          </Button>
        )
      }
    >
      {writing && (
        <JournalEditor
          label="New journal entry"
          saveLabel="Add entry"
          onSave={(body) =>
            attempt(() => create({ data: { characterId, body } }), (r) => {
              setEntries((all) => [r.entry, ...(all ?? [])])
              setWriting(false)
            })
          }
          onCancel={() => setWriting(false)}
        />
      )}
      {loadError ? (
        <p className="text-ui text-muted-foreground">{loadError}</p>
      ) : !entries ? (
        <p className="text-ui text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        !writing && <p className="text-ui text-muted-foreground">No entries yet. Only you can read your journal unless you share an entry.</p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry) => (
            <JournalEntryItem
              key={entry.id}
              entry={entry}
              inCampaign={inCampaign}
              onEdit={(body) => attempt(() => edit({ data: { entryId: entry.id, body } }), (r) => replace(r.entry))}
              onShare={(shared) => attempt(() => share({ data: { entryId: entry.id, shared } }), (r) => replace(r.entry))}
              onDelete={() =>
                attempt(() => remove({ data: { entryId: entry.id } }), () => setEntries((all) => all?.filter((e) => e.id !== entry.id) ?? all))
              }
            />
          ))}
        </ol>
      )}
    </Section>
  )
}
