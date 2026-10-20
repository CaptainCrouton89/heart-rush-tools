// Home: no sidebar or outline. Book title, subtitle, the Introduction's opening two sentences, a search field that
// opens the palette, three task columns, the Alaria row and the sibling sites.
import { Link, createFileRoute } from '@tanstack/react-router'
import { pageTitle } from '~/components/landing/book-page'
import { AT_THE_TABLE, LEARN_THE_GAME, RUN_THE_GAME } from '~/components/landing/home-links'
import { TaskLinks } from '~/components/landing/task-column'
import { SearchIcon } from '~/components/shell/icons'
import { ExternalLink, SITES } from '~/components/shell/links'
import { SiteShell } from '~/components/shell/site-shell'
import { openSearch } from '~/lib/search-store'
import { getHomeFn } from '~/server/content'

export const Route = createFileRoute('/')({
  loader: () => getHomeFn(),
  head: () => pageTitle(undefined),
  component: Home,
})

const rowLink = 'max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center text-control font-medium text-primary underline underline-offset-4 hover:decoration-2'

function Home() {
  const { intro, mapUrl } = Route.useLoaderData()
  return (
    <SiteShell nav={null} activePath="/">
      <div className="max-w-[1040px] lg:pt-6">
        <h1 className="font-serif text-h1-sm font-semibold text-foreground md:text-home-title">Heart Rush</h1>
        <p className="mt-2 font-serif text-h3 text-muted-foreground">Rules for dangerous, tactical fantasy</p>
        <p className="mt-6 max-w-[720px] font-serif text-body-sm text-foreground md:text-body">{intro}</p>

        <button
          type="button"
          onClick={openSearch}
          className="mt-8 flex h-12 w-full max-w-[720px] items-center gap-3 rounded-md border border-input bg-surface px-4 text-left text-[16px] text-muted-foreground transition-colors hover:border-foreground md:text-control"
        >
          <SearchIcon />
          <span>Search the rules, GM guide and Alaria…</span>
        </button>

        <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <TaskLinks column={LEARN_THE_GAME} />
          <TaskLinks column={AT_THE_TABLE} />
          <TaskLinks column={RUN_THE_GAME} />
        </div>

        <section aria-labelledby="home-alaria" className="mt-14 flex flex-wrap items-baseline gap-x-8 gap-y-3 border-y border-border py-5">
          <h2 id="home-alaria" className="font-serif text-h4 font-semibold text-foreground">Alaria</h2>
          <Link to="/worlds/alaria" className={rowLink}>Explore Alaria</Link>
          <ExternalLink href={mapUrl} className={rowLink}>World map</ExternalLink>
        </section>

        <nav aria-label="Other Heart Rush sites" className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
          {SITES.map((s) => (
            <ExternalLink key={s.href} href={s.href} className={rowLink}>{s.label}</ExternalLink>
          ))}
        </nav>
      </div>
    </SiteShell>
  )
}
