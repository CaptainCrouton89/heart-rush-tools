// Below 1024px: the Menu button and its full-height sheet — the three books, the current book's tree,
// then Tools ↗ / Play ↗ and appearance. Choosing a destination closes the sheet and focuses the page H1.
import { useRef, useState, type MouseEvent } from 'react'
import { Link } from '@tanstack/react-router'
import type { NavNode } from '@heartrush/content/types'
import { Button } from '@heartrush/ui/components/button'
import { AppearanceMenu } from '@heartrush/ui/components/appearance-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@heartrush/ui/components/sheet'
import { cn } from '@heartrush/ui/lib/utils'
import { BOOKS, ExternalLink, SITES, inBook } from './links'
import { MenuIcon } from './icons'
import { NavTree } from './nav-tree'
import { consumeHeadingFocus, requestHeadingFocus } from './focus-heading'
import type { LocalNav } from './site-shell'

const row = 'flex min-h-11 items-center rounded-sm px-3.5 text-control transition-colors hover:bg-surface-muted'

export function MobileMenu({ nav, activePath, localNav }: { nav: NavNode | null; activePath: string; localNav: LocalNav | null }) {
  const [open, setOpen] = useState(false)
  // Set when a destination was chosen, so closing does not hand focus back to the Menu button.
  const chose = useRef(false)

  // A plain click on an in-site link: the router navigates; we close the sheet and queue the H1 focus.
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as HTMLElement).closest('a[href]')
    if (!(anchor instanceof HTMLAnchorElement) || anchor.origin !== window.location.origin) return
    requestHeadingFocus(anchor.pathname)
    chose.current = true
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu" className="size-11 lg:hidden">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        closeLabel="Close menu"
        className="max-w-none overflow-hidden sm:max-w-sm"
        onCloseAutoFocus={(event) => {
          if (!chose.current) return
          chose.current = false
          event.preventDefault()
          // The current page chosen again: no path change will trigger the shell, so focus its H1 here.
          consumeHeadingFocus(activePath)
        }}
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain" onClickCapture={onClickCapture}>
          <nav aria-label="Books" className="border-b border-border p-2">
            <ul>
              {BOOKS.map((book) => {
                const active = inBook(book.path, activePath)
                return (
                  <li key={book.path}>
                    <Link
                      to={book.path}
                      aria-current={activePath === book.path ? 'page' : active ? 'true' : undefined}
                      className={cn(row, active ? 'font-medium text-foreground' : 'text-muted-foreground')}
                    >
                      {book.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          {nav && (
            <div className="border-b border-border p-2">
              <NavTree nav={nav} activePath={activePath} localNav={localNav} touch label={`${nav.label} contents`} />
            </div>
          )}
          <nav aria-label="Heart Rush sites" className="border-b border-border p-2">
            <ul>
              {SITES.map((site) => (
                <li key={site.href}>
                  <ExternalLink href={site.href} className={cn(row, 'text-muted-foreground')}>
                    {site.label}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center justify-between py-2 pr-2 pl-5.5">
            <span className="text-control text-foreground">Appearance</span>
            <AppearanceMenu />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
