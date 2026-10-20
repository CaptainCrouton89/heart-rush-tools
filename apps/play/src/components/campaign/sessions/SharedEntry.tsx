import { useState } from 'react'
import { JournalMarkdown } from '~/components/journal/JournalMarkdown'
import type { SharedJournalEntry } from '~/server/journal'

/** The first line with text in it, without its leading Markdown marker (`#`, `-`, `*`, `1.`, `>`). */
function firstLine(body: string): string {
  const line = body.split('\n').find((l) => l.trim()) ?? ''
  return line.trim().replace(/^(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s*)/, '')
}

/**
 * One shared journal entry in the session log (spec §2.2, §6): the character's name and the entry's first line; pressing
 * it expands the whole entry in place. Only shared entries ever reach this component — `listSessionsFn` reads them from
 * J1's `listSharedJournal`, which never returns an unshared one (INV-PRIVATE).
 */
export function SharedEntry({ entry }: { entry: SharedJournalEntry }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-baseline gap-2 py-2 text-left hover:bg-surface-muted"
      >
        <span className="shrink-0 text-ui font-semibold">{entry.characterName || 'Unnamed character'}</span>
        <span className={open ? 'min-w-0 text-ui text-muted-foreground' : 'min-w-0 truncate text-ui text-muted-foreground'}>
          {open ? (entry.inGameDay !== null ? `Day ${entry.inGameDay}` : '') : firstLine(entry.body)}
        </span>
      </button>
      {open && (
        <div className="pb-3">
          <JournalMarkdown source={entry.body} />
        </div>
      )}
    </li>
  )
}

/** A list of shared entries, newest first as the server gives them. */
export function SharedEntryList({ entries }: { entries: SharedJournalEntry[] }) {
  return (
    <ul className="flex flex-col" aria-label="Shared journal entries">
      {entries.map((e) => (
        <SharedEntry key={e.id} entry={e} />
      ))}
    </ul>
  )
}
