import { Fragment, type ReactNode } from 'react'

// The Markdown a player types into a journal entry, rendered as React elements (never as HTML, so a body cannot inject
// markup): `#` headings, paragraphs with their line breaks kept, `-`/`*` and `1.` lists, `>` quotes, `---` rules, and
// inline `**bold**`, `*italic*`/`_italic_`, `` `code` `` and `[text](https://…)` links. Anything else shows as typed.

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\b_[^_\s][^_]*_\b)|(\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const at = m.index
    if (at > last) out.push(text.slice(last, at))
    const token = m[0]
    const key = out.length
    if (m[1]) out.push(<code key={key} className="rounded-sm bg-surface-muted px-1 font-mono text-[0.9em]">{token.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={key} className="font-semibold">{inline(token.slice(2, -2))}</strong>)
    else if (m[3] || m[4]) out.push(<em key={key}>{inline(token.slice(1, -1))}</em>)
    else {
      const split = token.indexOf('](')
      out.push(
        <a key={key} href={token.slice(split + 2, -1)} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-4">
          {inline(token.slice(1, split))}
        </a>,
      )
    }
    last = at + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const HEADING = /^(#{1,6})\s+(.*)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const startsBlock = (line: string) => HEADING.test(line) || BULLET.test(line) || NUMBERED.test(line) || QUOTE.test(line) || RULE.test(line)

function blocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const out: ReactNode[] = []
  let i = 0
  // Collects consecutive lines matching `re`, returning their first capture group.
  const run = (re: RegExp): string[] => {
    const items: string[] = []
    let m: RegExpExecArray | null
    while (i < lines.length && (m = re.exec(lines[i]))) {
      items.push(m[1])
      i++
    }
    return items
  }
  while (i < lines.length) {
    const line = lines[i]
    const key = out.length
    if (!line.trim()) {
      i++
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      out.push(<h3 key={key} className="font-sans text-control font-semibold">{inline(heading[2])}</h3>)
      i++
    }
    else if (RULE.test(line)) {
      out.push(<hr key={key} className="border-border" />)
      i++
    }
    else if (BULLET.test(line)) out.push(<ul key={key} className="list-disc pl-5 marker:text-muted-foreground">{run(BULLET).map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>)
    else if (NUMBERED.test(line)) out.push(<ol key={key} className="list-decimal pl-5 marker:text-muted-foreground">{run(NUMBERED).map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>)
    else if (QUOTE.test(line)) {
      out.push(
        <blockquote key={key} className="border-l-2 border-border pl-3 italic text-muted-foreground">
          {run(QUOTE).map((t, j) => <Fragment key={j}>{j > 0 && <br />}{inline(t)}</Fragment>)}
        </blockquote>,
      )
    }
    else {
      const para: string[] = []
      while (i < lines.length && lines[i].trim() && (para.length === 0 || !startsBlock(lines[i]))) para.push(lines[i++])
      out.push(<p key={key}>{para.map((t, j) => <Fragment key={j}>{j > 0 && <br />}{inline(t)}</Fragment>)}</p>)
    }
  }
  return out
}

/** A journal entry body rendered from its Markdown. */
export function JournalMarkdown({ source }: { source: string }) {
  return <div className="flex flex-col gap-2 text-ui break-words">{blocks(source)}</div>
}
