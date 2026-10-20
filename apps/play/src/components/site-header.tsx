import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import type { Session } from '~/server/session'
import { Button } from '@heartrush/ui/components/button'
import { Wordmark } from '@heartrush/ui/components/wordmark'
import { AppearanceMenu } from '@heartrush/ui/components/appearance-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@heartrush/ui/components/sheet'

// Plain links: /campaigns is built by a later unit, so it is not in the typed route tree yet.
const SECTIONS = [
  { href: '/characters', label: 'Characters' },
  { href: '/campaigns', label: 'Campaigns' },
] as const

const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/')

/** The sign-in link (back to `returnTo` afterwards) or the signed-in name and a Sign out form. */
function SessionControl({ session, returnTo, showName }: { session: Session | null; returnTo: string; showName: boolean }) {
  if (!session) {
    return (
      <Button size="compact" variant="line-primary" asChild>
        <a href={`/auth/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</a>
      </Button>
    )
  }
  return (
    <form method="post" action="/auth/logout" className="flex items-center gap-3">
      {showName && <span className="hidden max-w-48 truncate text-ui text-muted-foreground md:inline">{session.displayName}</span>}
      <Button size="compact" type="submit" variant="line">
        Sign out
      </Button>
    </form>
  )
}

/** Lucide's Menu glyph. `lucide-react` is not an apps/play dependency; the base styles size `svg.lucide`. */
function MenuIcon() {
  return (
    <svg className="lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h16M4 18h16M4 6h16" />
    </svg>
  )
}

/** Below 640px the section links, appearance menu and Sign out move into a Menu sheet. */
function PhoneMenu({ session, returnTo, pathname }: { session: Session | null; returnTo: string; pathname: string }) {
  const [open, setOpen] = useState(false)
  const row = 'flex min-h-11 items-center rounded-sm px-3 text-control text-foreground hover:bg-surface-muted aria-[current=page]:font-semibold'
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="compact-icon" variant="ghost" className="sm:hidden" aria-label="Menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>Heart Rush Play</SheetTitle>
        </SheetHeader>
        <nav aria-label="Play" className="flex flex-col gap-1 p-2">
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className={row} aria-current={isCurrent(pathname, s.href) ? 'page' : undefined}>
              {s.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t border-border px-5 py-2">
          <span className="text-control text-foreground">Appearance</span>
          <AppearanceMenu />
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
          {session && <p className="text-ui text-muted-foreground">Signed in as {session.displayName}</p>}
          <SessionControl session={session} returnTo={returnTo} showName={false} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Play's header: the Wordmark (to heartrush.party), Characters / Campaigns, appearance, and Sign in / Sign out. */
export function SiteHeader({ session }: { session: Session | null }) {
  const { pathname, searchStr } = useLocation()
  const returnTo = pathname + searchStr
  const link =
    'flex min-h-11 items-center rounded-sm text-ui text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:font-semibold aria-[current=page]:text-foreground'
  return (
    <header className="print-hidden sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-5 max-[359px]:px-4 sm:gap-6 md:h-16 md:px-8">
        <div className="flex items-center gap-2">
          <a href="https://heartrush.party/" className="flex min-h-11 items-center rounded-sm" aria-label="Heart Rush home">
            <Wordmark className="font-label text-[18px] font-normal normal-case" />
          </a>
          <Link to="/" className="flex min-h-11 items-center rounded-sm text-ui text-muted-foreground hover:text-foreground max-[359px]:hidden">
            <span className="border-l border-border pl-2">Play</span>
          </Link>
        </div>
        <nav aria-label="Play" className="hidden items-center gap-5 sm:flex">
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className={link} aria-current={isCurrent(pathname, s.href) ? 'page' : undefined}>
              {s.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <AppearanceMenu />
            <SessionControl session={session} returnTo={returnTo} showName />
          </div>
          {!session && (
            <div className="sm:hidden">
              <SessionControl session={session} returnTo={returnTo} showName={false} />
            </div>
          )}
          <PhoneMenu session={session} returnTo={returnTo} pathname={pathname} />
        </div>
      </div>
    </header>
  )
}
