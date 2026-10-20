import { useId, useState } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@heartrush/ui/components/dialog'
import type { JournalEntry } from '~/server/journal'
import { JournalEditor } from './JournalEditor'
import { JournalMarkdown } from './JournalMarkdown'

const time = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** "Oct 20, 2026, 3:14 PM · Day 5 · Session 2", leaving out the day and session when they are not set. */
export function entryStamp(entry: Pick<JournalEntry, 'createdAt' | 'inGameDay' | 'sessionNumber'>): string {
  return [time(entry.createdAt), entry.inGameDay !== null && `Day ${entry.inGameDay}`, entry.sessionNumber !== null && `Session ${entry.sessionNumber}`]
    .filter(Boolean)
    .join(' · ')
}

/**
 * One entry: its stamp, the rendered body, the **Share with campaign** switch (only when the character is in a campaign,
 * or the entry is still shared from an earlier one so it can be unshared), and Edit / Delete with a confirm. Each
 * callback resolves to an error text, or null on success.
 */
export function JournalEntryItem({
  entry,
  inCampaign,
  onEdit,
  onDelete,
  onShare,
}: {
  entry: JournalEntry
  inCampaign: boolean
  onEdit: (body: string) => Promise<string | null>
  onDelete: () => Promise<string | null>
  onShare: (shared: boolean) => Promise<string | null>
}) {
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (write: () => Promise<string | null>) => {
    setBusy(true)
    const failed = await write()
    setBusy(false)
    setError(failed)
    return failed
  }

  const save = async (body: string) => {
    const failed = await onEdit(body)
    if (!failed) setEditing(false)
    return failed
  }

  const remove = async () => {
    if (!(await run(onDelete))) setConfirming(false)
  }

  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <time dateTime={entry.createdAt} className="text-meta text-muted-foreground tabular-nums">{entryStamp(entry)}</time>

      {editing ? (
        <JournalEditor initial={entry.body} label="Edit entry" saveLabel="Save" onSave={save} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <JournalMarkdown source={entry.body} />
          <div className="flex flex-wrap items-center gap-2">
            {(inCampaign || entry.shared) && (
              <div className="mr-auto flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={entry.shared}
                  aria-labelledby={`${id}-share`}
                  disabled={busy}
                  onClick={() => void run(() => onShare(!entry.shared))}
                  className="inline-flex size-11 shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-6 w-full items-center rounded-md border transition-colors ${entry.shared ? 'border-primary bg-primary' : 'border-input bg-surface-muted'}`}
                  >
                    <span
                      className={`inline-block size-4 rounded-sm transition-transform ${entry.shared ? 'translate-x-6 bg-primary-foreground' : 'translate-x-1 bg-muted-foreground'}`}
                    />
                  </span>
                </button>
                <span id={`${id}-share`} className="text-ui">Share with campaign</span>
              </div>
            )}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => { setError(null); setEditing(true) }}>
                Edit
              </Button>
              <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => { setError(null); setConfirming(true) }}>
                Delete
              </Button>
            </div>
          </div>
          {error && !confirming && <p role="alert" className="text-ui text-destructive">{error}</p>}
        </>
      )}

      <Dialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this entry?</DialogTitle>
            <DialogDescription>
              {entry.shared ? 'It is shared, so it also disappears from the campaign’s session log. ' : ''}This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-ui text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button type="button" className="min-h-11" disabled={busy} onClick={() => void remove()}>
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
