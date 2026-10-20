// 404 page: the root route's notFoundComponent, so unknown URLs and loaders that throw notFound() land here.
import { Link, useLocation } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'
import { openSearch } from '~/lib/search-store'
import { SiteShell } from './shell/site-shell'

const destinations: Array<{ path: string; label: string; description: string }> = [
  { path: '/player', label: 'Player rules', description: 'The rules every player uses.' },
  { path: '/gm', label: 'GM guide', description: 'Pacing, encounters and travel for the person running the game.' },
  { path: '/worlds/alaria', label: 'Alaria', description: 'The world of Alaria: places, powers, history and magic.' },
]

export function NotFound() {
  const { pathname } = useLocation()
  return (
    <SiteShell nav={null} activePath={pathname}>
      <div className="max-w-[720px]">
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-2 font-serif text-h1-sm font-semibold text-foreground md:text-h1">Page not found</h1>
        <p className="mt-4 font-serif text-body-sm text-foreground md:text-body">
          Nothing is published at <code className="font-sans text-control break-all">{pathname}</code>. The page may have
          moved when the rulebook was reorganised. Search for it, or start from one of the books.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={openSearch}>Search the rules</Button>
          <Button variant="outline" asChild>
            <a href="/search">Open the search page</a>
          </Button>
        </div>
        <ul className="mt-10 border-t border-border">
          {destinations.map((d) => (
            <li key={d.path} className="border-b border-border">
              <Link to={d.path} className="group flex flex-col gap-1 py-4">
                <span className="text-control font-medium text-primary group-hover:underline">{d.label}</span>
                <span className="text-ui text-muted-foreground">{d.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </SiteShell>
  )
}
