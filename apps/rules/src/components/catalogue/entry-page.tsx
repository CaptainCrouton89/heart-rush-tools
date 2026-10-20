// A catalogue entry (/player/talents/<slug>, /player/spells/<slug>, /player/kin-culture/<slug>): breadcrumbs, H1, the
// original metadata line next to its normalized labels, the full source body (Destiny Level is an ordinary H2 in it),
// Back to the catalogue and the article actions. No previous/next: alphabetical neighbours are not a reading order.
import type { MouseEvent } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import type { NavNode, PageFile, RaceFacets, TalentFacets } from '@heartrush/content/types'
import { ArticleActions } from '~/components/article/actions'
import { ArticleBody } from '~/components/article/body'
import { canonicalUrl } from '~/components/article/canonical'
import { SiteShell } from '~/components/shell/site-shell'
import { metadataLabels, type CatalogueConfig } from './config'
import { FROM_CATALOGUE } from './catalogue-page'
import { Crumbs } from './crumbs'

export function EntryPage({ config, page, nav }: { config: CatalogueConfig; page: PageFile; nav: NavNode }) {
  const router = useRouter()
  const labels = page.facets ? metadataLabels(config.kind, page.facets as TalentFacets | RaceFacets) : []
  const raw = page.rawMetadata ? stripEmphasis(page.rawMetadata) : null

  // Reached from the list: go back through history so its filters, page and scroll come back as they were.
  const back = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    const state = router.state.location.state as unknown as Record<string, unknown>
    if (state[FROM_CATALOGUE] === config.kind) {
      event.preventDefault()
      router.history.back()
    }
  }

  return (
    <SiteShell nav={nav} activePath={page.path}>
      <Crumbs crumbs={page.breadcrumbs} current={page.title} />
      <h1 className="mt-3 font-serif text-h1-sm font-semibold text-foreground md:text-h1">{page.title}</h1>
      <p className="print-only mt-2 font-sans text-meta">{canonicalUrl(page.path)}</p>
      {(raw || labels.length > 0) && (
        <div className="mt-3 font-sans text-ui text-muted-foreground">
          {labels.length > 0 && (
            <dl className="flex flex-wrap gap-x-4 gap-y-1">
              {labels.map(([term, value]) => (
                <div key={term} className="flex gap-1">
                  <dt>{term}:</dt>
                  <dd className="font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {raw && (
            <p className="mt-1">
              <span className="sr-only">Source metadata: </span>
              <span className="italic">{raw}</span>
            </p>
          )}
        </div>
      )}
      <div className="mt-4">
        <ArticleActions path={page.path} />
      </div>
      <div className="mt-6">
        <ArticleBody blocks={page.body} contentVersion={page.contentVersion} />
      </div>
      <p className="print-hidden mt-10 border-t border-border pt-4">
        <Link to={config.path} onClick={back} className="inline-flex min-h-11 items-center text-control text-primary underline underline-offset-4 hover:decoration-2">
          <span aria-hidden="true">&lt;&nbsp;</span>Back to {config.backLabel}
        </Link>
      </p>
    </SiteShell>
  )
}

/** The metadata line is authored as `_Major ability. Martial talent._`; show its words without the Markdown marks. */
function stripEmphasis(line: string) {
  return line.trim().replace(/^[_*]+|[_*]+$/g, '').trim()
}
