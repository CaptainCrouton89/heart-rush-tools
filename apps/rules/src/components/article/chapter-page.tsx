// A player or GM chapter (the design's "section page"): breadcrumbs, category eyebrow, H1, Copy link / Print,
// "On this page" below 1280px, the whole chapter body, and previous/next chapter links naming their destinations.
// The /player/$chapter and /gm/$chapter routes load the data and render this.
import { Link } from '@tanstack/react-router'
import type { NavNode, PageFile } from '@heartrush/content/types'
import { ExternalLink } from '~/components/shell/links'
import { SiteShell } from '~/components/shell/site-shell'
import { hasOutline } from '~/lib/outline'
import type { ReadingLink } from '~/server/content'
import { ArticleActions } from './actions'
import { ArticleBody } from './body'
import { ArticleBreadcrumbs } from './breadcrumbs'
import { canonicalUrl } from './canonical'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { ArticleOutline, MobileOutline } from './outline'

export type ChapterData = {
  page: PageFile
  nav: NavNode
  previous: ReadingLink | null
  next: ReadingLink | null
}

/** The design's one chapter-specific action: Monster creation links to the monster generator on the tools site. */
const MONSTER_CREATION_ID = 'gm.monster-creation'
const MONSTER_TOOLS_URL = 'https://tools.heartrush.party/monster-generator'

export function ChapterPage({ page, nav, previous, next }: ChapterData) {
  // The eyebrow names the category (the immediate parent landing); suppressed when it repeats the title.
  const category = page.breadcrumbs.at(-1)?.title ?? null
  const eyebrow = category && category.toLowerCase() !== page.title.toLowerCase() ? category : null
  const book = page.breadcrumbs[0]?.title

  return (
    <SiteShell
      nav={nav}
      activePath={page.path}
      outline={hasOutline(page.headings) ? <ArticleOutline headings={page.headings} /> : null}
    >
      <article>
        <header>
          <div className="print-only mb-4 font-sans text-meta">
            <p>Heart Rush{book ? ` · ${book}` : ''}</p>
            <p className="font-serif text-h1-sm font-semibold">{page.title}</p>
            <p>{canonicalUrl(page.path)}</p>
          </div>
          <ArticleBreadcrumbs crumbs={page.breadcrumbs} current={page.navTitle} />
          {eyebrow && <p className="eyebrow mt-6">{eyebrow}</p>}
          <h1
            className={`print-hidden font-serif text-h1-sm font-semibold text-balance text-foreground md:text-h1 ${eyebrow ? 'mt-1' : 'mt-6'}`}
          >
            {page.title}
          </h1>
          <div className="mt-4">
            <ArticleActions path={page.path}>
              {page.id === MONSTER_CREATION_ID && (
                <ExternalLink
                  href={MONSTER_TOOLS_URL}
                  className="inline-flex h-11 items-center px-1 text-ui font-medium text-primary underline underline-offset-4 hover:decoration-2 lg:h-8"
                >
                  Open monster tools
                </ExternalLink>
              )}
            </ArticleActions>
          </div>
        </header>
        <MobileOutline headings={page.headings} />
        <div className="mt-8">
          <ArticleBody blocks={page.body} contentVersion={page.contentVersion} />
        </div>
        {(previous || next) && (
          <nav aria-label="Chapters" className="print-hidden mt-16 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
            {previous && <SequenceLink link={previous} direction="previous" />}
            {next && <SequenceLink link={next} direction="next" />}
          </nav>
        )}
      </article>
    </SiteShell>
  )
}

function SequenceLink({ link, direction }: { link: ReadingLink; direction: 'previous' | 'next' }) {
  const isNext = direction === 'next'
  return (
    <Link
      to={link.path}
      rel={isNext ? 'next' : 'prev'}
      className={`group flex min-h-11 items-center gap-2 rounded-md py-2 text-foreground ${isNext ? 'justify-end text-right sm:col-start-2' : ''}`}
    >
      {!isNext && <ChevronLeftIcon className="text-muted-foreground" />}
      <span className="flex flex-col">
        <span className="text-meta text-muted-foreground">{isNext ? 'Next chapter' : 'Previous chapter'}</span>
        <span className="text-control font-medium text-primary underline-offset-4 group-hover:underline">{link.title}</span>
      </span>
      {isNext && <ChevronRightIcon className="text-muted-foreground" />}
    </Link>
  )
}

/** Route `head`: document title, description and canonical link for a loaded chapter. */
export function chapterHead(data: ChapterData | undefined) {
  if (!data) return {}
  const { page } = data
  return {
    meta: [
      { title: `${page.title} · ${page.breadcrumbs[0]?.title ?? 'Heart Rush'} · Heart Rush` },
      ...(page.description ? [{ name: 'description', content: page.description }] : []),
    ],
    links: [{ rel: 'canonical', href: canonicalUrl(page.path) }],
  }
}
