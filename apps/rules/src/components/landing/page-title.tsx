import type { ReactNode } from 'react'
import type { PageFile } from '@heartrush/content/types'
import { ArticleBreadcrumbs } from '~/components/article/breadcrumbs'
import { ExternalLink } from '~/components/shell/links'

/** Breadcrumbs (when the page has ancestors) and the page H1, with an optional item beside the title. */
export function PageTitle({ page, aside }: { page: PageFile; aside?: ReactNode }) {
  return (
    <>
      {page.breadcrumbs.length > 0 && <ArticleBreadcrumbs crumbs={page.breadcrumbs} current={page.title} />}
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="font-serif text-h1-sm font-semibold text-foreground md:text-h1">{page.title}</h1>
        {aside}
      </div>
    </>
  )
}

/** The external Alaria world map link shown beside the Alaria home title and on the Atlas landing. */
export function WorldMapLink({ href }: { href: string }) {
  return (
    <ExternalLink href={href} className="print-hidden max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center text-control font-medium text-primary underline underline-offset-4 hover:decoration-2">
      World map
    </ExternalLink>
  )
}
