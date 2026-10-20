// Ruled link rows for landing pages: title, the child's source-derived one-sentence excerpt and an arrow.
// Chapter rows also show reading minutes. Rows come from `page.childSummaries`; no child page is fetched.
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { ChildSummary } from '@heartrush/content/types'

export function LandingRows({ rows }: { rows: ChildSummary[] }) {
  return (
    <ul className="border-t border-border">
      {rows.map((row) => (
        <li key={row.id} className="border-b border-border">
          <Link to={row.path} className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-4">
            <span className="font-serif text-h4 font-semibold text-foreground group-hover:text-primary group-hover:underline group-hover:underline-offset-4">
              {row.title}
            </span>
            <span aria-hidden="true" className="row-span-2 self-center text-control text-muted-foreground group-hover:text-primary">
              →
            </span>
            {(row.description || (row.kind === 'chapter' && row.readingMinutes > 0)) && (
              <span className="text-ui text-muted-foreground">
                {row.description}
                {row.kind === 'chapter' && row.readingMinutes > 0 && (
                  <span className="text-meta whitespace-nowrap">
                    {row.description ? ' · ' : ''}
                    {row.readingMinutes} min read
                  </span>
                )}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** A titled block of rows. The title links to the group's own landing when it has one. */
export function RowGroup({ title, path, children }: { title: string; path?: string; children: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="mb-3 font-sans text-meta font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {path ? (
          <Link to={path} className="hover:text-foreground hover:underline hover:underline-offset-4">
            {title}
          </Link>
        ) : (
          title
        )}
      </h2>
      {children}
    </section>
  )
}
