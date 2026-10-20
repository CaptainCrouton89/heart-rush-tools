import { useState, type ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'
import { Wordmark } from '@heartrush/ui/components/wordmark'
import { AppearanceMenu } from '@heartrush/ui/components/appearance-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@heartrush/ui/components/sheet'

type Session = { userId: string; displayName: string } | null

const SIBLING_SITES = [
  { href: 'https://rules.heartrush.party/', label: 'Rules' },
  { href: 'https://play.heartrush.party/', label: 'Play' },
] as const

/** A link to another Heart Rush site: same tab, with a ↗ marker announced as "external site". */
function SiteLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} className={className}>
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (external site)</span>
    </a>
  )
}

function SessionControl({ session, returnTo }: { session: Session; returnTo: string }) {
  if (!session) {
    return (
      <Button asChild size="sm">
        <a href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</a>
      </Button>
    )
  }
  return (
    <form method="post" action="/auth/logout" className="flex items-center gap-3">
      <span className="hidden max-w-48 truncate text-ui text-muted-foreground md:inline">{session.displayName}</span>
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </form>
  )
}

/** Lucide's Menu glyph. `lucide-react` is not an apps/tools dependency; the base styles size `svg.lucide`. */
function MenuIcon() {
  return (
    <svg className="lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h16M4 18h16M4 6h16" />
    </svg>
  )
}

/** Below 640px the Rules and Play links and the appearance menu move into a Menu sheet, as on the rules site. */
function PhoneMenu({ session }: { session: Session }) {
  const [open, setOpen] = useState(false)
  const row = 'flex min-h-11 items-center gap-1 rounded-sm px-3 text-control text-foreground hover:bg-surface-muted'
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Heart Rush Tools</SheetTitle>
        </SheetHeader>
        <nav aria-label="Heart Rush sites" className="flex flex-col gap-1 p-2">
          <Link to="/" className={row} onClick={() => setOpen(false)}>
            All tools
          </Link>
          {SIBLING_SITES.map((site) => (
            <SiteLink key={site.href} href={site.href} className={row}>
              {site.label}
            </SiteLink>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-border px-5 py-2">
          <span className="text-control text-foreground">Appearance</span>
          <AppearanceMenu />
        </div>
        {session && <p className="px-5 py-2 text-ui text-muted-foreground">Signed in as {session.displayName}</p>}
      </SheetContent>
    </Sheet>
  )
}

export function SiteHeader({ session }: { session: Session }) {
  const { pathname } = useLocation()
  return (
    <header className="print-hidden sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-5 max-[359px]:px-4 sm:gap-6 md:h-16 md:px-8">
        <Link to="/" className="flex items-baseline gap-2 rounded-sm" aria-label="Heart Rush Tools home">
          <Wordmark />
          <span className="border-l border-border pl-2 text-ui text-muted-foreground max-[359px]:hidden">Tools</span>
        </Link>
        <nav aria-label="Heart Rush sites" className="hidden items-center gap-5 sm:flex">
          {SIBLING_SITES.map((site) => (
            <SiteLink
              key={site.href}
              href={site.href}
              className="rounded-sm text-ui text-muted-foreground transition-colors hover:text-foreground"
            >
              {site.label}
            </SiteLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="hidden sm:block">
            <AppearanceMenu />
          </div>
          <SessionControl session={session} returnTo={pathname} />
          <PhoneMenu session={session} />
        </div>
      </div>
    </header>
  )
}
