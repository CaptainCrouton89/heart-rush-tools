// Route component shared by every compiled page inside a book below its home: player/GM group landings and every
// page under /worlds/alaria. The loader is getBookPageFn; this picks the layout from the page kind.
import type { PageFile } from '@heartrush/content/types'
import { ArticleOutline } from '~/components/article/outline'
import { SiteShell, type LocalNav } from '~/components/shell/site-shell'
import { hasOutline } from '~/lib/outline'
import type { NavNode } from '@heartrush/content/types'
import { LandingPage } from './landing-page'
import { WorldMapLink } from './page-title'
import { LandingRows, RowGroup } from './rows'
import { WorldArticle } from './world-article'

type Link = { title: string; path: string }
export type BookPageData = {
  page: PageFile
  nav: NavNode
  localNav: LocalNav | null
  groups: Array<{ id: string; title: string; path: string; rows: PageFile['childSummaries'] }> | null
  sequence: { previous: Link | null; next: Link | null } | null
  mapUrl: string
}

export function BookPage({ data }: { data: BookPageData }) {
  const { page, nav, localNav, groups, sequence, mapUrl } = data
  const showsMap = page.id === 'worlds.alaria' || page.id === 'worlds.alaria.topics.atlas'
  return (
    <SiteShell nav={nav} activePath={page.path} localNav={localNav} outline={hasOutline(page.headings) ? <ArticleOutline headings={page.headings} /> : null}>
      {page.kind === 'landing' ? (
        <LandingPage page={page} titleAside={showsMap ? <WorldMapLink href={mapUrl} /> : undefined}>
          {groups?.map((g) => (
            <RowGroup key={g.id} title={g.title} path={g.path}>
              <LandingRows rows={g.rows} />
            </RowGroup>
          ))}
        </LandingPage>
      ) : (
        <WorldArticle page={page} sequence={sequence} />
      )}
    </SiteShell>
  )
}

export const pageTitle = (title: string | undefined) => ({ meta: [{ title: title ? `${title} · Heart Rush` : 'Heart Rush' }] })
