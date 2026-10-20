// Global header. ≥1024px: wordmark, the three books, the labelled Search button, Tools ↗, Play ↗, appearance.
// Below 1024px: wordmark, Search and Menu in a 56px bar; the Menu sheet carries everything else.
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { NavNode } from '@heartrush/content/types'
import { Button } from '@heartrush/ui/components/button'
import { Wordmark } from '@heartrush/ui/components/wordmark'
import { AppearanceMenu } from '@heartrush/ui/components/appearance-menu'
import { cn } from '@heartrush/ui/lib/utils'
import { openSearch } from '~/lib/search-store'
import { SearchIcon } from './icons'
import { BOOKS, ExternalLink, SITES, inBook } from './links'
import { MobileMenu } from './mobile-menu'
import type { LocalNav } from './site-shell'

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere. The server and first client render say "Ctrl K". */
function useShortcutLabel() {
  const [label, setLabel] = useState('Ctrl K')
  useEffect(() => {
    if (/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)) setLabel('⌘K')
  }, [])
  return label
}

export function SiteHeader({ nav, activePath, localNav }: { nav: NavNode | null; activePath: string; localNav: LocalNav | null }) {
  const shortcut = useShortcutLabel()
  return (
    <header className="print-hidden sticky top-0 z-40 h-14 border-b border-border bg-surface lg:h-16">
      <div className="mx-auto flex h-full w-full max-w-[1440px] items-center gap-2 px-5 max-[359px]:px-4 md:px-8 lg:gap-8">
        <Link to="/" className="mr-auto flex items-center rounded-sm lg:mr-0" aria-label="Heart Rush home">
          <Wordmark />
        </Link>

        <nav aria-label="Books" className="hidden h-full items-stretch gap-6 lg:flex">
          {BOOKS.map((book) => {
            const active = inBook(book.path, activePath)
            return (
              <Link
                key={book.path}
                to={book.path}
                aria-current={activePath === book.path ? 'page' : active ? 'true' : undefined}
                className={cn(
                  'flex items-center border-y-2 border-transparent text-ui transition-colors hover:text-foreground',
                  active ? 'border-b-primary font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {book.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden flex-1 items-center justify-end gap-6 lg:flex">
          <Button
            variant="outline"
            onClick={openSearch}
            aria-keyshortcuts="Meta+K Control+K"
            className="w-56 justify-start gap-2 px-3 text-ui font-normal text-muted-foreground xl:w-64"
          >
            <SearchIcon />
            <span className="flex-1 text-left">Search</span>
            <kbd className="rounded-sm border border-border px-1.5 font-sans text-meta text-muted-foreground">{shortcut}</kbd>
          </Button>
          <nav aria-label="Heart Rush sites" className="flex items-center gap-5">
            {SITES.map((site) => (
              <ExternalLink
                key={site.href}
                href={site.href}
                className="rounded-sm text-ui text-muted-foreground transition-colors hover:text-foreground"
              >
                {site.label}
              </ExternalLink>
            ))}
          </nav>
          <AppearanceMenu />
        </div>

        <Button variant="ghost" size="icon" onClick={openSearch} aria-label="Search" className="size-11 lg:hidden">
          <SearchIcon />
        </Button>
        <MobileMenu nav={nav} activePath={activePath} localNav={localNav} />
      </div>
    </header>
  )
}
