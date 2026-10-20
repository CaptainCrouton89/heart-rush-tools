import { Fragment, type ReactNode } from 'react'

/** `**bold**` inside one line of chat text. */
function inline(text: string): ReactNode {
  const pieces = text.split(/\*\*(.+?)\*\*/g)
  if (pieces.length === 1) return text
  return pieces.map((piece, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {piece}
      </strong>
    ) : (
      <Fragment key={i}>{piece}</Fragment>
    ),
  )
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
