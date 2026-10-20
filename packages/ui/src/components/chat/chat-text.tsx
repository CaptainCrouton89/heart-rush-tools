import { Fragment, type ReactNode } from 'react'

const RULES_SITE = 'https://rules.heartrush.party/'

/** `**bold**` inside a piece of a line. */
function bold(text: string, key: string): ReactNode {
  const pieces = text.split(/\*\*(.+?)\*\*/g)
  if (pieces.length === 1) return text
  return pieces.map((piece, i) =>
    i % 2 === 1 ? (
      <strong key={`${key}-${i}`} className="font-semibold">
        {piece}
      </strong>
    ) : (
      <Fragment key={`${key}-${i}`}>{piece}</Fragment>
    ),
  )
}

/** `**bold**` and `[text](url)` inside one line of chat text. Only links to the rules site are links; any other link is its text. */
function inline(text: string): ReactNode {
  const pieces = text.split(/\[([^\]]+)\]\(([^)\s]+)\)/g)
  if (pieces.length === 1) return bold(text, 'b')
  const out: ReactNode[] = []
  for (let i = 0; i < pieces.length; i += 3) {
    if (pieces[i]) out.push(bold(pieces[i], `t${i}`))
    if (i + 2 >= pieces.length) break
    const label = pieces[i + 1]
    const url = pieces[i + 2]
    out.push(
      url.startsWith(RULES_SITE) ? (
        <a key={`a${i}`} href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {bold(label, `l${i}`)}
        </a>
      ) : (
        <Fragment key={`a${i}`}>{bold(label, `l${i}`)}</Fragment>
      ),
    )
  }
  return out
}

/**
 * Chat text with the little Markdown the agent and the composed answers use: paragraphs split by blank lines, `- `
 * bullet lines, `**bold**`, and single line breaks kept.
 */
export function ChatText({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        if (lines.every((l) => /^\s*[-*•] /.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted-foreground [&:not(:first-child)]:mt-3">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*•] /, ''))}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="[&:not(:first-child)]:mt-3">
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
