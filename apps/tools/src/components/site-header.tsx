import { Link } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'

export function SiteHeader({ session }: { session: { userId: string; displayName: string } | null }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/" className="font-semibold">
            Heart Rush Tools
          </Link>
          <a href="https://rules.heartrush.party" className="text-muted-foreground hover:text-foreground">
            Rules
          </a>
          <a href="https://play.heartrush.party" className="text-muted-foreground hover:text-foreground">
            Play
          </a>
        </nav>
        {session ? (
          <form method="post" action="/auth/logout" className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{session.displayName}</span>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        ) : (
          <Button asChild size="sm">
            <a href="/auth/login">Sign in with Northlight</a>
          </Button>
        )}
      </div>
    </header>
  )
}
