// Fallback destinations shown when search has nothing to offer: zero results or an unavailable index.
import { cn } from '@heartrush/ui/lib/utils'

export const BOOK_LINKS: Array<{ path: string; label: string }> = [
  { path: '/player', label: 'Player rules' },
  { path: '/gm', label: 'GM guide' },
  { path: '/worlds/alaria', label: 'Alaria' },
]

/** Links to the three book landings. `onNavigate` replaces a plain left click (the palette closes first). */
export function BookLinks({ onNavigate, className }: { onNavigate?: (path: string) => void; className?: string }) {
  return (
    <nav aria-label="Books" className={className}>
      <p className="text-ui text-muted-foreground">Browse a book instead:</p>
      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
        {BOOK_LINKS.map((b) => (
          <li key={b.path}>
            <a
              href={b.path}
              onClick={(e) => {
                if (!onNavigate || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                e.preventDefault()
                onNavigate(b.path)
              }}
              className={cn('inline-flex min-h-11 items-center text-control font-medium text-primary underline underline-offset-4 lg:min-h-8')}
            >
              {b.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
