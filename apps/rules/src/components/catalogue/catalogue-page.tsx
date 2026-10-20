// A catalogue list page (/player/talents, /player/spells, /player/kin-culture): breadcrumbs, title, local search,
// facet filters, sort, 30-per-page pagination and the result table, then the collection's authored introduction.
// All list state lives in the URL (see query.ts); the route passes the validated search params in.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import type { Block, CatalogueEntry, CatalogueFile, NavNode, PageFile } from '@heartrush/content/types'
import { Alert, AlertDescription } from '@heartrush/ui/components/alert'
import { Button } from '@heartrush/ui/components/button'
import { Input } from '@heartrush/ui/components/input'
import { Popover, PopoverContent, PopoverTrigger } from '@heartrush/ui/components/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@heartrush/ui/components/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@heartrush/ui/components/table'
import { cn } from '@heartrush/ui/lib/utils'
import { ArticleBody } from '~/components/article/body'
import { SiteShell } from '~/components/shell/site-shell'
import type { CatalogueConfig } from './config'
import { Crumbs } from './crumbs'
import {
  PAGE_SIZE,
  SORTS,
  compute,
  indexEntries,
  parseState,
  selectedCount,
  toSearch,
  toggle,
  type CatalogueSearch,
  type FacetView,
  type Selection,
  type Sort,
} from './query'

/** History state on links from a list row, so the entry's Back link knows the previous entry is this list. */
export const FROM_CATALOGUE = 'heartrushCatalogue'

const ABOUT_ID = 'about'

export type CataloguePageProps = {
  config: CatalogueConfig
  page: PageFile
  catalogue: CatalogueFile
  nav: NavNode
  search: CatalogueSearch
}

export function CataloguePage({ config, page, catalogue, nav, search }: CataloguePageProps) {
  const navigate = useNavigate()
  const items = useMemo(() => indexEntries(catalogue, config), [catalogue, config])
  const state = parseState(search, config, catalogue)

  // The input is local so typing stays smooth; each settled query gets a history entry.
  const [query, setQuery] = useState(state.query)
  const lastPushed = useRef(state.query)
  useEffect(() => {
    if (state.query !== lastPushed.current) {
      lastPushed.current = state.query
      setQuery(state.query)
    }
  }, [state.query])

  const go = (next: { query?: string; sort?: Sort; selection?: Selection; page?: number }) => {
    const target = toSearch(config, {
      query: next.query ?? query,
      sort: next.sort ?? state.sort,
      selection: next.selection ?? state.selection,
      page: next.page,
    })
    if (next.query !== undefined) lastPushed.current = next.query
    void navigate({ to: config.path, search: target as never, resetScroll: false })
  }

  /** Text query and facet selection together: "Clear" in every form returns all records. */
  const applyFilters = (selection: Selection, nextQuery: string) => {
    setQuery(nextQuery)
    go({ query: nextQuery, selection })
  }
  const clearAll = () => applyFilters({}, '')

  useEffect(() => {
    if (query === lastPushed.current) return
    const timer = setTimeout(() => go({ query }), 250)
    return () => clearTimeout(timer)
  })

  const { results, facets } = useMemo(
    () => compute(items, catalogue, config, query, state.selection, state.sort),
    [items, catalogue, config, query, state.selection, state.sort],
  )
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const unavailable = [...state.unavailable]
  let current = state.page
  if (current > pageCount) {
    unavailable.push(`page ${current}`)
    current = pageCount
  }
  const shown = results.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const selected = selectedCount(state.selection)
  const hasAbout = page.body.length > 0
  const pageSearch = (n: number) => toSearch(config, { query, sort: state.sort, selection: state.selection, page: n }) as never

  return (
    <SiteShell nav={nav} activePath={page.path}>
      <Crumbs crumbs={page.breadcrumbs} current={page.title} />
      <h1 className="mt-3 font-serif text-h1-sm font-semibold text-foreground md:text-h1">{config.title}</h1>
      <p className="mt-3 font-serif text-body-sm text-foreground md:text-body">{config.lede}</p>
      {hasAbout && (
        <p className="print-hidden mt-2 text-ui">
          <a href={`#${ABOUT_ID}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4 hover:decoration-2 lg:min-h-0">
            {config.aboutHeading} <span aria-hidden="true">↓</span>
          </a>
        </p>
      )}

      <search aria-label={`Find ${config.noun}`} className="print-hidden mt-6 block">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); go({ query }) }} role="search">
          <label className="sr-only" htmlFor="catalogue-query">{config.searchLabel}</label>
          <Input
            id="catalogue-query"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${config.searchLabel}…`}
            autoComplete="off"
            className="h-11 lg:h-10"
          />
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {facets.map((facet) => (
              <FacetPopover key={facet.key} facet={facet} picked={state.selection[facet.key] ?? []} onToggle={(v) => go({ selection: toggle(state.selection, facet.key, v) })} />
            ))}
            {selected > 0 && (
              <Button type="button" variant="ghost" size="sm" className="max-lg:h-11" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 md:hidden">
            <FilterSheet facetsFor={(sel, q) => compute(items, catalogue, config, q, sel, state.sort)} selection={state.selection} query={query} noun={config.noun} onApply={applyFilters} />
            {selected > 0 && (
              <Button type="button" variant="ghost" className="h-11" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
        </form>
      </search>

      {unavailable.length > 0 && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>
            Some filters were unavailable and have been ignored: {unavailable.join(', ')}.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <p className="text-ui text-foreground" aria-live="polite" aria-atomic="true">
          {results.length === catalogue.entries.length && selected === 0 && !query.trim()
            ? `${results.length} ${config.noun}`
            : `${results.length} of ${catalogue.entries.length} ${config.noun}`}
        </p>
        <div className="print-hidden flex items-center gap-2">
          <label htmlFor="catalogue-sort" className="text-ui text-muted-foreground">Sort</label>
          <select
            id="catalogue-sort"
            value={state.sort}
            onChange={(e) => go({ sort: e.target.value as Sort })}
            className="h-11 rounded-md border border-input bg-surface px-2 font-sans text-base text-foreground lg:h-10 md:text-ui"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="py-8 text-ui text-foreground">
          <p>No {config.noun} match{query.trim() ? <> “{query.trim()}”</> : null}{selected > 0 ? ' with these filters' : ''}.</p>
          {(selected > 0 || query) && (
            <Button type="button" variant="outline" className="mt-3 h-11 lg:h-10" onClick={clearAll}>
              Clear search and filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <ResultTable config={config} entries={shown} />
          <ResultRows config={config} entries={shown} />
        </>
      )}

      {pageCount > 1 && (
        <nav aria-label={`${config.title} pages`} className="print-hidden mt-6 flex items-center justify-between gap-3">
          <PageLink disabled={current <= 1} to={config.path} search={pageSearch(current - 1)}>Previous</PageLink>
          <p className="text-ui text-muted-foreground">Page {current} of {pageCount}</p>
          <PageLink disabled={current >= pageCount} to={config.path} search={pageSearch(current + 1)}>Next</PageLink>
        </nav>
      )}

      {hasAbout && (
        <section aria-labelledby={ABOUT_ID} className="mt-16 border-t border-border pt-2">
          <div className="prose-rules">
            <h2 id={ABOUT_ID}>{config.aboutHeading}</h2>
          </div>
          <ArticleBody blocks={demoteHeadings(page.body)} contentVersion={page.contentVersion} />
        </section>
      )}
    </SiteShell>
  )
}

/** The introduction sits under the "About …" H2, so its own headings move down one level. */
function demoteHeadings(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.type === 'heading') return { ...b, depth: Math.min(6, b.depth + 1) }
    if (b.type === 'blockquote' || b.type === 'callout') return { ...b, children: demoteHeadings(b.children) }
    return b
  })
}

function PageLink({ disabled, to, search, children }: { disabled: boolean; to: string; search: never; children: ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled="true" className="inline-flex h-11 items-center px-4 text-control text-muted-foreground opacity-60">
        {children}
      </span>
    )
  }
  return (
    <Button variant="outline" size="lg" asChild>
      <Link to={to} search={search}>{children}</Link>
    </Button>
  )
}

function rowMeta(config: CatalogueConfig, entry: CatalogueEntry) {
  return config.columns.map((c) => ({ header: c.header, value: c.cell(entry) }))
}

function EntryLink({ config, entry, className }: { config: CatalogueConfig; entry: CatalogueEntry; className?: string }) {
  return (
    <Link
      to={entry.path}
      state={(prev) => ({ ...prev, [FROM_CATALOGUE]: config.kind }) as never}
      className={cn('font-medium text-primary underline-offset-4 hover:underline', className)}
    >
      {entry.title}
    </Link>
  )
}

/** ≥768px: semantic table, Name plus the catalogue's columns. */
function ResultTable({ config, entries }: { config: CatalogueConfig; entries: CatalogueEntry[] }) {
  return (
    <Table className="hidden md:table">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Name</TableHead>
          {config.columns.map((c) => <TableHead key={c.header} scope="col">{c.header}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="min-w-36">
              <EntryLink config={config} entry={entry} className="max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center" />
            </TableCell>
            {rowMeta(config, entry).map((m) => (
              <TableCell key={m.header} className={cn(!m.value && 'text-muted-foreground')}>
                {m.value ?? 'Not specified'}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Below 768px: stacked rows of Name, metadata and one sentence. */
function ResultRows({ config, entries }: { config: CatalogueConfig; entries: CatalogueEntry[] }) {
  return (
    <ul className="md:hidden">
      {entries.map((entry) => {
        const meta = rowMeta(config, entry).filter((m) => m.header !== 'Description')
        return (
          <li key={entry.id} className="border-b border-border py-3">
            <EntryLink config={config} entry={entry} className="inline-flex min-h-11 min-w-11 items-center text-control" />
            <p className="text-meta text-muted-foreground">
              {meta.map((m, i) => (
                <span key={m.header}>
                  {i > 0 && <span aria-hidden="true"> · </span>}
                  <span className="sr-only">{m.header}: </span>
                  {m.value ?? `${m.header} not specified`}
                </span>
              ))}
            </p>
            {entry.description && <p className="mt-1 font-serif text-body-sm text-foreground">{entry.description}</p>}
          </li>
        )
      })}
    </ul>
  )
}

function FacetOptions({ facet, picked, onToggle, touch }: { facet: FacetView; picked: string[]; onToggle: (value: string) => void; touch: boolean }) {
  return (
    <fieldset>
      <legend className={cn('font-semibold text-foreground', touch ? 'mb-1 text-control' : 'sr-only')}>{facet.label}</legend>
      <ul>
        {facet.values.map((v) => {
          const id = `facet-${touch ? 'sheet' : 'pop'}-${facet.param}-${v.value}`.replace(/\s+/g, '-')
          const checked = picked.includes(v.value)
          return (
            <li key={v.value}>
              <label htmlFor={id} className={cn('flex cursor-pointer items-center gap-3 rounded-sm px-1 text-ui text-foreground hover:bg-surface-muted', touch ? 'min-h-11' : 'min-h-8')}>
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(v.value)}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="flex-1">{v.label}</span>
                <span className="text-meta tabular-nums text-muted-foreground">{v.count}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}

/** ≥768px: one popover per facet; a change applies at once. */
function FacetPopover({ facet, picked, onToggle }: { facet: FacetView; picked: string[]; onToggle: (value: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={cn('max-lg:h-11', picked.length > 0 && 'border-primary text-accent-foreground bg-accent')}>
          {facet.label}
          {picked.length > 0 && <span className="tabular-nums">({picked.length}<span className="sr-only"> selected</span>)</span>}
          <span aria-hidden="true">▾</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <FacetOptions facet={facet} picked={picked} onToggle={onToggle} touch={false} />
      </PopoverContent>
    </Popover>
  )
}

/**
 * Below 768px: a Filters sheet. Changes stay in the sheet until Apply; Cancel, Close or a tap outside discards them.
 * Clear empties the selection and the text query, matching the page's Clear filters; Apply then shows all records.
 * The button's number is how many values are selected, not an entry count.
 */
function FilterSheet({
  facetsFor,
  selection,
  query,
  noun,
  onApply,
}: {
  facetsFor: (selection: Selection, query: string) => { results: CatalogueEntry[]; facets: FacetView[] }
  selection: Selection
  query: string
  noun: string
  onApply: (selection: Selection, query: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Selection>(selection)
  const [draftQuery, setDraftQuery] = useState(query)
  const view = useMemo(() => facetsFor(draft, draftQuery), [facetsFor, draft, draftQuery])
  const count = selectedCount(selection)
  const openSheet = (next: boolean) => {
    if (next) {
      setDraft(selection)
      setDraftQuery(query)
    }
    setOpen(next)
  }
  return (
    <Sheet open={open} onOpenChange={openSheet}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" className="h-11">
          Filters{count > 0 && <span className="tabular-nums">({count}<span className="sr-only"> selected</span>)</span>}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" closeLabel="Close filters">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription aria-live="polite">{view.results.length} {noun} match</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-4 py-4">
          {view.facets.map((facet) => (
            <FacetOptions key={facet.key} facet={facet} picked={draft[facet.key] ?? []} onToggle={(v) => setDraft((d) => toggle(d, facet.key, v))} touch />
          ))}
        </div>
        <SheetFooter className="flex-wrap">
          <Button type="button" variant="ghost" className="h-11" onClick={() => { setDraft({}); setDraftQuery('') }} disabled={selectedCount(draft) === 0 && !draftQuery}>
            Clear
          </Button>
          <Button type="button" variant="outline" className="ml-auto h-11" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="h-11" onClick={() => { onApply(draft, draftQuery); setOpen(false) }}>
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
