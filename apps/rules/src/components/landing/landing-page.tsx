// A compiled landing page (player/GM group, Alaria category, topic or region index): breadcrumbs, H1, a sentence
// describing the area, the authored body when the source has one, then ruled rows for its children.
import type { ReactNode } from 'react'
import type { PageFile } from '@heartrush/content/types'
import { ArticleBody } from '~/components/article/body'
import { MobileOutline } from '~/components/article/outline'
import { areaDescription } from './area-descriptions'
import { PageTitle } from './page-title'
import { LandingRows } from './rows'

export function LandingPage({ page, titleAside, children }: { page: PageFile; titleAside?: ReactNode; children?: ReactNode }) {
  const hasBody = page.body.length > 0
  const description = areaDescription(page.id, page.description)
  return (
    <article>
      <PageTitle page={page} aside={titleAside} />
      {/* Do not repeat the description when the body already opens with its source paragraph. */}
      {page.body[0]?.type !== 'paragraph' && description && <p className="mt-4 font-serif text-body-sm text-foreground md:text-body">{description}</p>}
      {hasBody && (
        <>
          <MobileOutline headings={page.headings} />
          <div className="mt-6">
            <ArticleBody blocks={page.body} contentVersion={page.contentVersion} />
          </div>
        </>
      )}
      <div className="mt-10">{children ?? (page.childSummaries.length > 0 && <LandingRows rows={page.childSummaries} />)}</div>
    </article>
  )
}
