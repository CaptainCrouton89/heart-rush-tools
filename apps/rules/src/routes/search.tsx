// /search?q=&scope=&kind=&page= — the shareable results page. Same adapter, filters, ranking and row as the palette;
// it adds the content-kind filter and 20-per-page URL pagination. Results load in the browser on demand.
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { cn } from '@heartrush/ui/lib/utils'
import { SiteShell } from '~/components/shell/site-shell'
import { ResultRow } from '~/components/search/result-row'
import { BookLinks } from '~/components/search/states'
import {
  KINDS,
  SCOPES,
  isSearchable,
  parseKind,
  parseScope,
  searchPage,
  warmSearch,
  type PageResults,
  type SearchKind,
  type SearchScope,
} from '~/lib/search'

const PER_PAGE = 20
const LOADING_DELAY_MS = 200

type SearchParams = { q: string; scope: SearchScope; kind: SearchKind | null; page: number }

/** The URL form: defaults are omitted, unknown values are dropped. */
type UrlSearch = { q?: string; scope?: Exclude<SearchScope, 'all'>; kind?: SearchKind; page?: number }

export const Route = createFileRoute('/search')({
  validateSearch: (s: Record<string, unknown>): UrlSearch => {
    const page = Number(s.page ?? 1)
    const scope = parseScope(s.scope)
    const q = s.q == null ? '' : String(s.q)
    return {
      q: q || undefined,
      scope: scope === 'all' ? undefined : scope,
      kind: parseKind(s.kind) ?? undefined,
      page: Number.isSafeInteger(page) && page > 1 ? page : undefined,
    }
  },
  head: ({ match }) => ({
    meta: [{ title: match.search.q ? `“${match.search.q}” — Search — Heart Rush Rules` : 'Search — Heart Rush Rules' }],
  }),
  component: SearchPage,
})

type State =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'done'; key: string; query: string; results: PageResults }
  | { status: 'error' }

/** Search params as they appear in the URL: defaults omitted. */
function urlSearch(p: SearchParams): UrlSearch {
  return {
    q: p.q || undefined,
    scope: p.scope === 'all' ? undefined : p.scope,
    kind: p.kind ?? undefined,
    page: p.page > 1 ? p.page : undefined,
  }
}

function SearchPage() {
  const url = Route.useSearch()
  const params: SearchParams = { q: url.q ?? '', scope: url.scope ?? 'all', kind: url.kind ?? null, page: url.page ?? 1 }
  const { q, scope, kind, page } = params
  const navigate = useNavigate({ from: '/search' })
  const [draft, setDraft] = useState(q)
  const [state, setState] = useState<State>({ status: 'idle' })
  const [showLoading, setShowLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const seq = useRef(0)
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const query = q.trim()
  const key = `${query}\u0000${scope}\u0000${kind ?? ''}\u0000${page}`

  useEffect(() => setDraft(q), [q])
  useEffect(() => warmSearch(), [])

  useEffect(() => {
    const id = ++seq.current
    if (!isSearchable(query)) {
      setState({ status: 'idle' })
      setShowLoading(false)
      return
    }
    setState({ status: 'pending' })
    const loadingTimer = setTimeout(() => id === seq.current && setShowLoading(true), LOADING_DELAY_MS)
    searchPage(query, scope, kind, page, PER_PAGE).then(
      (results) => {
        if (id !== seq.current) return
        clearTimeout(loadingTimer)
        setShowLoading(false)
        setState({ status: 'done', key, query, results })
      },
      () => {
        if (id !== seq.current) return
        clearTimeout(loadingTimer)
        setShowLoading(false)
        setState({ status: 'error' })
      },
    )
    return () => { clearTimeout(loadingTimer); seq.current++ }
  }, [key, retryCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (next: Partial<SearchParams>, focusResults = false) => {
    void navigate({ search: urlSearch({ ...params, page: 1, ...next }) }).then(() => {
      if (focusResults) resultsHeading.current?.focus()
    })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    set({ q: draft.trim() })
  }

  const filtered = scope !== 'all' || kind !== null
  const done = state.status === 'done' && state.key === key ? state.results : null
  const shownQuery = state.status === 'done' ? state.query : query
  const pages = done ? Math.max(1, Math.ceil(done.total / PER_PAGE)) : 1

  return (
    <SiteShell nav={null} activePath="/search">
      <div className="mx-auto w-full max-w-[1060px]">
        <h1 className="font-serif text-h1-sm font-semibold text-foreground md:text-h1">Search</h1>

        <form role="search" action="/search" method="get" onSubmit={onSubmit} className="mt-5 flex max-w-[800px] gap-2 lg:ml-[252px]">
          <label htmlFor="search-page-q" className="sr-only">
            Search the rules
          </label>
          <Input
            id="search-page-q"
            name="q"
            type="search"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search rules, talents, spells, kin and Alaria"
            className="h-11 md:text-base lg:text-ui"
          />
          {scope !== 'all' && <input type="hidden" name="scope" value={scope} />}
          {kind && <input type="hidden" name="kind" value={kind} />}
          <Button type="submit" className="h-11">
            Search
          </Button>
        </form>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-8">
          <aside aria-label="Filters" className="lg:w-[220px] lg:shrink-0">
            <FilterGroup
              legend="Book"
              name="scope"
              options={SCOPES.map((s) => ({ value: s.value, label: s.label }))}
              value={scope}
              onChange={(v) => set({ scope: v as SearchScope }, true)}
            />
            <FilterGroup
              legend="Content"
              name="kind"
              options={[{ value: '', label: 'All content' }, ...KINDS.map((k) => ({ value: k.value, label: k.label }))]}
              value={kind ?? ''}
              onChange={(v) => set({ kind: (v || null) as SearchKind | null }, true)}
              className="mt-6"
            />
            {filtered && (
              <Button type="button" variant="link" className="mt-4 text-ui" onClick={() => set({ scope: 'all', kind: null }, true)}>
                Clear filters
              </Button>
            )}
          </aside>

          <section aria-labelledby="search-results-heading" className="min-w-0 max-w-[800px] flex-1">
            <h2
              id="search-results-heading"
              ref={resultsHeading}
              tabIndex={-1}
              className="text-control font-medium text-foreground outline-none"
              aria-live="polite"
            >
              {!isSearchable(query)
                ? query
                  ? 'Type at least 2 characters'
                  : 'Enter a search above'
                : state.status === 'error'
                  ? 'Search unavailable'
                  : done
                    ? done.total === 0
                      ? `No results for “${shownQuery}”`
                      : `${done.total === 1 ? '1 result' : `${done.total} results`} for “${shownQuery}”`
                    : showLoading
                      ? 'Searching…'
                      : ''}
            </h2>

            {state.status === 'error' && (
              <div className="mt-3">
                <p className="text-ui text-muted-foreground">The search index could not be loaded. The rules are still readable from the books.</p>
                <Button type="button" variant="outline" size="sm" className="mt-3 h-11 lg:h-8" onClick={() => setRetryCount((n) => n + 1)}>
                  Retry
                </Button>
                <BookLinks className="mt-4" />
              </div>
            )}

            {done && done.total === 0 && (
              <div className="mt-3">
                {filtered && (
                  <Button type="button" variant="link" className="text-ui" onClick={() => set({ scope: 'all', kind: null }, true)}>
                    Clear filters
                  </Button>
                )}
                <BookLinks className="mt-2" />
              </div>
            )}

            {done && done.total > 0 && (
              <>
                {done.hits.length === 0 ? (
                  <p className="mt-3 text-ui text-muted-foreground">
                    There is no page {page}.{' '}
                    <Link to="/search" search={urlSearch({ ...params, page: 1 })} className="text-primary underline underline-offset-4">
                      Go to page 1
                    </Link>
                  </p>
                ) : (
                  <ol className={cn('mt-3 flex flex-col border-t border-border', state.status === 'done' && state.key !== key && 'opacity-60')}>
                    {done.hits.map((hit) => (
                      <li key={hit.id} className="border-b border-border py-1">
                        <ResultRow hit={hit} />
                      </li>
                    ))}
                  </ol>
                )}
                {pages > 1 && (
                  <nav aria-label="Result pages" className="mt-6 flex items-center justify-between gap-3">
                    <PageLink params={params} page={page - 1} disabled={page <= 1} label="Previous" />
                    <span className="text-ui text-muted-foreground">
                      Page {Math.min(page, pages)} of {pages}
                    </span>
                    <PageLink params={params} page={page + 1} disabled={page >= pages} label="Next" />
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </SiteShell>
  )
}

function PageLink({ params, page, disabled, label }: { params: SearchParams; page: number; disabled: boolean; label: string }) {
  if (disabled) {
    return (
      <Button variant="outline" disabled className="h-11 min-w-24">
        {label}
      </Button>
    )
  }
  return (
    <Button variant="outline" asChild className="h-11 min-w-24">
      <Link to="/search" search={urlSearch({ ...params, page })}>
        {label}
      </Link>
    </Button>
  )
}

function FilterGroup({
  legend,
  name,
  options,
  value,
  onChange,
  className,
}: {
  legend: string
  name: string
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <fieldset className={className}>
      <legend className="eyebrow mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 lg:flex-col">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-ui text-foreground lg:min-h-9">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="size-4 accent-primary"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
