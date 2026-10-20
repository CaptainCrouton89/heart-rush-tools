// The global ⌘K search palette. Mounted once by the root route; opened by the header button, the home search field
// and ⌘K/Ctrl K through `openSearch()`. A full-screen dialog below 1024px, a 680px dialog near the top above it.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@heartrush/ui/components/dialog'
import { Input } from '@heartrush/ui/components/input'
import { Button } from '@heartrush/ui/components/button'
import { cn } from '@heartrush/ui/lib/utils'
import { closeSearch, useSearchOpen } from '~/lib/search-store'
import {
  SCOPES,
  focusDestination,
  isSearchable,
  searchGrouped,
  searchHref,
  warmSearch,
  type PaletteResults,
  type SearchHit,
  type SearchScope,
} from '~/lib/search'
import { XIcon } from '~/components/shell/icons'
import { ResultRow } from './result-row'
import { BookLinks } from './states'

const QUICK_LINKS: Array<{ path: string; label: string }> = [
  { path: '/player/combat', label: 'Combat' },
  { path: '/player/conditions', label: 'Conditions' },
  { path: '/player/dice-mechanics-resolution', label: 'Dice mechanics' },
  { path: '/player/talents', label: 'Talents' },
  { path: '/player/kin-culture', label: 'Kin & culture' },
  { path: '/gm', label: 'GM guide' },
]

const DEBOUNCE_MS = 150
const LOADING_DELAY_MS = 200

type State =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'done'; query: string; scope: SearchScope; results: PaletteResults }
  | { status: 'error' }

export function SearchPalette() {
  const open = useSearchOpen()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const [state, setState] = useState<State>({ status: 'idle' })
  const [showLoading, setShowLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const [retryCount, setRetryCount] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const seq = useRef(0)
  const navigating = useRef<{ path: string; anchor: string | null } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const invokingElement = useRef<HTMLElement | null>(null)
  const baseId = useId()

  // Every open starts fresh: empty query, scope All.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setScope('all')
    setState({ status: 'idle' })
    setActive(-1)
    setAnnouncement('')
    warmSearch()
  }, [open])

  // Query → results. Debounced; a response for an older query or scope is dropped.
  useEffect(() => {
    if (!open) return
    const id = ++seq.current
    const q = query.trim()
    if (!isSearchable(q)) {
      setState({ status: 'idle' })
      setShowLoading(false)
      setActive(-1)
      return
    }
    setState({ status: 'pending' })
    setActive(-1)
    setAnnouncement('')
    const loadingTimer = setTimeout(() => id === seq.current && setShowLoading(true), DEBOUNCE_MS + LOADING_DELAY_MS)
    const timer = setTimeout(() => {
      searchGrouped(q, scope).then(
        (results) => {
          if (id !== seq.current) return
          clearTimeout(loadingTimer)
          setShowLoading(false)
          setState({ status: 'done', query: q, scope, results })
          setActive(results.total > 0 ? 0 : -1)
          setAnnouncement(results.total > 0 ? `${countLabel(results.total)} for “${q}”` : `No results for “${q}”`)
        },
        () => {
          if (id !== seq.current) return
          clearTimeout(loadingTimer)
          setShowLoading(false)
          setState({ status: 'error' })
          setActive(-1)
          setAnnouncement('Search unavailable')
        },
      )
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      clearTimeout(loadingTimer)
      seq.current++
    }
  }, [open, query, scope, retryCount])

  const settled = state.status === 'done' && state.query === query.trim() && state.scope === scope
  const hits: SearchHit[] = settled ? state.results.groups.flatMap((g) => g.hits) : []
  const optionId = (i: number) => `${baseId}-hit-${i}`

  useEffect(() => {
    if (active < 0) return
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  function go(path: string, anchor: string | null) {
    navigating.current = { path, anchor }
    closeSearch()
    void navigate({ href: anchor ? `${path}#${anchor}` : path })
  }

  function openHit(hit: SearchHit) {
    go(hit.path, hit.anchor)
  }

  function openResultsPage() {
    const q = query.trim()
    if (!q) return
    navigating.current = { path: '/search', anchor: null }
    closeSearch()
    void navigate({ href: searchHref(q, scope) })
  }

  function onQueryKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    const last = hits.length - 1
    switch (e.key) {
      case 'ArrowDown':
        if (last < 0) return
        e.preventDefault()
        setActive((a) => Math.min(a + 1, last))
        break
      case 'ArrowUp':
        if (last < 0) return
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
        break
      case 'Home':
        if (active < 0) return
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        if (active < 0) return
        e.preventDefault()
        setActive(last)
        break
      case 'Enter':
        e.preventDefault()
        if (active >= 0 && hits[active]) openHit(hits[active])
        else openResultsPage()
        break
    }
  }

  const q = query.trim()
  const searchable = isSearchable(q)
  let flatIndex = 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeSearch()}>
      <DialogContent
        showClose={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          invokingElement.current = document.activeElement as HTMLElement | null
          inputRef.current?.focus()
        }}
        onCloseAutoFocus={(e) => {
          const dest = navigating.current
          navigating.current = null
          e.preventDefault()
          if (!dest) invokingElement.current?.focus()
          else if (dest.path !== '/search') focusDestination(dest.path, dest.anchor)
        }}
        className={cn(
          // Phone and tablet: full screen, safe-area insets, independently scrolling results.
          'inset-0 top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0',
          'pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
          // ≥1024px: 680px, near the top, at most 75dvh.
          'lg:inset-auto lg:top-[12dvh] lg:left-1/2 lg:h-auto lg:max-h-[75dvh] lg:w-[calc(100%-2rem)] lg:max-w-[680px] lg:-translate-x-1/2 lg:rounded-lg lg:border lg:p-0',
        )}
      >
        <div className="flex flex-col gap-3 border-b border-border px-4 pt-3 pb-3 lg:px-6 lg:pt-5">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="font-sans text-control font-semibold">Search Heart Rush</DialogTitle>
            <div className="flex items-center gap-2">
              <kbd className="hidden font-sans text-meta text-muted-foreground lg:inline">Esc</kbd>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="size-11 lg:size-10" aria-label="Close search">
                  <XIcon />
                </Button>
              </DialogClose>
            </div>
          </div>
          <label htmlFor={`${baseId}-q`} className="sr-only">
            Search the rules
          </label>
          <Input
            ref={inputRef}
            id={`${baseId}-q`}
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Search rules, talents, spells, kin and Alaria"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onQueryKeyDown}
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={`${baseId}-results`}
            aria-autocomplete="list"
            aria-activedescendant={hits[active] ? optionId(active) : undefined}
            className="h-11 md:text-base lg:h-10 lg:text-ui"
          />
          <div role="group" aria-label="Search in" className="flex flex-wrap gap-1.5">
            {SCOPES.map((s) => (
              <Button
                key={s.value}
                type="button"
                size="sm"
                variant={scope === s.value ? 'secondary' : 'ghost'}
                aria-pressed={scope === s.value}
                onClick={() => setScope(s.value)}
                className={cn('h-11 lg:h-8', scope === s.value && 'bg-accent text-accent-foreground')}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 lg:px-4">
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
          {!searchable && (
            <div className="px-2 py-2">
              {q.length > 0 && <p className="mb-3 text-ui text-muted-foreground">Type at least 2 characters</p>}
              <h2 className="eyebrow mb-2">Go to</h2>
              <ul className="grid gap-0.5 sm:grid-cols-2">
                {QUICK_LINKS.map((l) => (
                  <li key={l.path}>
                    <a
                      href={l.path}
                      onClick={(e) => {
                        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                        e.preventDefault()
                        go(l.path, null)
                      }}
                      className="flex min-h-11 items-center rounded-md px-3 text-control text-foreground hover:bg-surface-muted lg:min-h-9"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {searchable && state.status === 'pending' && showLoading && (
            <p className="px-3 py-3 text-ui text-muted-foreground">Searching…</p>
          )}

          {searchable && state.status === 'error' && (
            <div className="px-3 py-3">
              <p className="text-control font-medium text-foreground">Search unavailable</p>
              <p className="mt-1 text-ui text-muted-foreground">The search index could not be loaded. The rules are still readable from the books.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3 h-11 lg:h-8" onClick={() => setRetryCount((n) => n + 1)}>
                Retry
              </Button>
              <BookLinks onNavigate={(path) => go(path, null)} className="mt-4" />
            </div>
          )}

          {searchable && settled && state.results.total === 0 && (
            <div className="px-3 py-3">
              <p className="text-control font-medium text-foreground">No results for “{state.query}”</p>
              {scope !== 'all' && (
                <Button type="button" variant="link" className="mt-1 text-ui" onClick={() => setScope('all')}>
                  Search all books
                </Button>
              )}
              <BookLinks onNavigate={(path) => go(path, null)} className="mt-3" />
            </div>
          )}

          {searchable && settled && state.results.total > 0 && (
            <div id={`${baseId}-results`} role="listbox" aria-label="Search results">
              {state.results.groups.map((g) => (
                <div key={g.scope} role="group" aria-label={g.label} className="mb-2">
                  <div aria-hidden="true" className="eyebrow px-3 pt-2 pb-1">
                    {g.label}
                  </div>
                  {g.hits.map((hit) => {
                    const i = flatIndex++
                    return (
                      <ResultRow
                        key={hit.id}
                        id={optionId(i)}
                        hit={hit}
                        active={i === active}
                        onActivate={openHit}
                        onPointerEnter={() => setActive(i)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {searchable && (state.status === 'done' || state.status === 'pending') && (
            <a
              href={searchHref(q, scope)}
              onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                e.preventDefault()
                openResultsPage()
              }}
              className="mt-1 flex min-h-11 items-center rounded-md px-3 text-control font-medium text-primary underline-offset-4 hover:underline lg:min-h-9"
            >
              View all results for “{q}” →
            </a>
          )}
        </div>

        <div aria-hidden="true" className="hidden gap-5 border-t border-border px-6 py-2.5 text-meta text-muted-foreground lg:flex">
          <span>↑↓ Navigate</span>
          <span>Enter Open</span>
          <span>Esc Close</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function countLabel(n: number) {
  return n === 1 ? '1 result' : `${n} results`
}
