// An Alaria source article: breadcrumbs, H1, copy-link/print actions, body, then "Back to <parent>". Previous/next
// appear only when the compiler declares an ordered source sequence; the siblings are on the parent landing and in
// the sidebar's local navigation.
import { Link } from '@tanstack/react-router'
import type { PageFile } from '@heartrush/content/types'
import { ArticleActions } from '~/components/article/actions'
import { ArticleBody } from '~/components/article/body'
import { MobileOutline } from '~/components/article/outline'
import { PageTitle } from './page-title'

type Sequence = { previous: { title: string; path: string } | null; next: { title: string; path: string } | null }

export function WorldArticle({ page, sequence }: { page: PageFile; sequence: Sequence | null }) {
  const parent = page.breadcrumbs.at(-1)
  const previous = sequence?.previous
  const next = sequence?.next
  return (
    <article>
      <PageTitle page={page} />
      <p className="print-only mt-2 font-sans text-meta">{`https://rules.heartrush.party${page.path}`}</p>
      <div className="mt-4">
        <ArticleActions path={page.path} />
      </div>
      <MobileOutline headings={page.headings} />
      <div className="mt-6">
        <ArticleBody blocks={page.body} contentVersion={page.contentVersion} />
      </div>
      {parent && (
        <nav aria-label="Around this article" className="print-hidden mt-16 border-t border-border pt-6">
          {previous || next ? (
            <div className="flex flex-wrap justify-between gap-4 text-control">
              {previous ? <Link to={previous.path} className="text-primary hover:underline">← {previous.title}</Link> : <span />}
              {next && <Link to={next.path} className="text-primary hover:underline">{next.title} →</Link>}
            </div>
          ) : null}
          <Link to={parent.path} className="mt-2 inline-flex min-h-11 items-center text-control font-medium text-primary underline-offset-4 hover:underline">
            ← Back to {parent.title}
          </Link>
        </nav>
      )}
    </article>
  )
}
