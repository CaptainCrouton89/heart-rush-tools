// One search result: title, ancestor path, at most two lines of excerpt with only the matching words marked.
// Shared by the palette and the /search page. A real link to the canonical destination.
import type { MouseEvent, Ref } from 'react'
import { cn } from '@heartrush/ui/lib/utils'
import type { SearchHit } from '~/lib/search'

export function ResultRow({
  hit,
  active = false,
  id,
  onActivate,
  onPointerEnter,
  linkRef,
}: {
  hit: SearchHit
  /** Palette only: the row the arrow keys point at. */
  active?: boolean
  /** Palette only: the id the query field's aria-activedescendant points at; also makes the link a listbox option. */
  id?: string
  /** Called on a plain left click (no modifier keys) instead of the browser's own navigation. */
  onActivate?: (hit: SearchHit) => void
  onPointerEnter?: () => void
  linkRef?: Ref<HTMLAnchorElement>
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onActivate || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    onActivate(hit)
  }
  return (
    <a
      ref={linkRef}
      id={id}
      role={id ? 'option' : undefined}
      aria-selected={id ? active : undefined}
      href={hit.href}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      data-active={active || undefined}
      className={cn(
        'group block rounded-md px-3 py-2.5 text-foreground outline-offset-[-2px] hover:bg-surface-muted',
        'data-[active]:bg-accent data-[active]:text-accent-foreground',
      )}
    >
      <span className="block text-control font-medium group-hover:underline">{hit.title}</span>
      {hit.ancestors.length > 0 && (
        <span className="mt-0.5 block truncate text-meta text-muted-foreground group-data-[active]:text-accent-foreground">
          {hit.ancestors.join(' › ')}
        </span>
      )}
      {hit.excerpt.length > 0 && (
        <span className="mt-1 line-clamp-2 text-ui text-muted-foreground group-data-[active]:text-accent-foreground group-data-[active]:[&_mark]:bg-surface">
          {hit.excerpt.map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
        </span>
      )}
    </a>
  )
}
