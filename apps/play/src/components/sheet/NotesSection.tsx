import { Fragment, type ReactNode } from 'react'
import { EditLink } from '~/components/edit/EditLink'
import type { SectionProps } from './SheetLayout'
import { Section } from './SheetLayout'

/** The character's notes, read-only; they are written on `/characters/$id/edit`. */
export function NotesSection({ character, canEdit }: SectionProps) {
  return (
    <Section
      title="Notes"
      action={canEdit && <EditLink block="notes" />}
    >
      {character.notes.trim() ? <NotesText markdown={character.notes} /> : <p className="text-ui text-muted-foreground">No notes.</p>}
    </Section>
  )
}

/**
 * Notes are markdown. This renders the subset people type in a notes box — `#` headings, paragraphs, line breaks,
 * `-`/`*` and `1.` lists, `**bold**`, `*italic*` and `` `code` `` — as React elements, so nothing in the text is ever
 * HTML. Anything else shows as the characters typed.
 */
export function NotesText({ markdown }: { markdown: string }) {
  const blocks: ReactNode[] = []
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push(
        <p key={i} className="font-sans text-control font-semibold">
          {inline(heading[2]!)}
        </p>,
      )
      i++
      continue
    }
    const bullet = /^\s*[-*+]\s+/
    const numbered = /^\s*\d+[.)]\s+/
    const list = bullet.test(line) ? bullet : numbered.test(line) ? numbered : null
    if (list) {
      const start = i
      const items: string[] = []
      while (i < lines.length && list.test(lines[i]!)) items.push(lines[i++]!.replace(list, ''))
      const ListTag = list === bullet ? 'ul' : 'ol'
      blocks.push(
        <ListTag key={start} className={`flex flex-col gap-1 pl-5 ${list === bullet ? 'list-disc' : 'list-decimal'}`}>
          {items.map((item, n) => (
            <li key={n}>{inline(item)}</li>
          ))}
        </ListTag>,
      )
      continue
    }
    const start = i
    const para: string[] = []
    while (i < lines.length && lines[i]!.trim() && !/^#{1,6}\s/.test(lines[i]!) && !bullet.test(lines[i]!) && !numbered.test(lines[i]!)) para.push(lines[i++]!)
    blocks.push(
      <p key={start}>
        {para.map((l, n) => (
          <Fragment key={n}>
            {n > 0 && <br />}
            {inline(l)}
          </Fragment>
        ))}
      </p>,
    )
  }
  return <div className="flex flex-col gap-2 text-body-sm break-words">{blocks}</div>
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`)/g

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, n) => {
    if (/^(\*\*|__).+\1$/.test(part)) return <strong key={n}>{part.slice(2, -2)}</strong>
    if (/^`.+`$/.test(part)) return <code key={n} className="rounded-sm bg-surface-muted px-1 font-mono text-[0.9em]">{part.slice(1, -1)}</code>
    if (/^([*_]).+\1$/.test(part)) return <em key={n}>{part.slice(1, -1)}</em>
    return part
  })
}
