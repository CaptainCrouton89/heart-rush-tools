// The one Pagefind adapter shared by the ⌘K palette and the /search page. Browser only: the Pagefind bundle at
// /_content/<contentVersion>/search/pagefind.js is imported the first time someone searches, never during reading.
// Both surfaces pass the same filters and the same ranking, and both order results by (score desc, id asc), so a
// query + scope returns the same destinations in the same order in the palette and on the page.
import type { FilterKind, PageKind, Scope } from '@heartrush/content/types'
import { getContentVersionFn } from '~/components/search/content-version'

export type SearchScope = 'all' | Scope
export type SearchKind = FilterKind

export const SCOPES: Array<{ value: SearchScope; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'player', label: 'Player rules' },
  { value: 'gm', label: 'GM guide' },
  { value: 'world:alaria', label: 'Alaria' },
]

export const KINDS: Array<{ value: SearchKind; label: string }> = [
  { value: 'rules', label: 'Rules' },
  { value: 'talents', label: 'Talents' },
  { value: 'spells', label: 'Spells' },
  { value: 'kin', label: 'Kin & culture' },
  { value: 'world', label: 'World articles' },
]

/** Corpus groups in the palette, one per published scope. */
export const CORPORA: Array<{ scope: Scope; label: string }> = [
  { scope: 'player', label: 'Player rules' },
  { scope: 'gm', label: 'GM guide' },
  { scope: 'world:alaria', label: 'Alaria' },
]

export const parseScope = (v: unknown): SearchScope => (SCOPES.some((s) => s.value === v) ? (v as SearchScope) : 'all')
export const parseKind = (v: unknown): SearchKind | null => (KINDS.some((k) => k.value === v) ? (v as SearchKind) : null)

/** At least two non-space characters before a query runs. */
export const MIN_QUERY_CHARS = 2
export const isSearchable = (q: string) => q.replace(/\s+/g, '').length >= MIN_QUERY_CHARS

export type ExcerptPart = { text: string; mark: boolean }

/** One result row: a single destination anchor. */
export type SearchHit = {
  id: string
  /** Canonical path plus `#anchor` when the hit is a heading. */
  href: string
  path: string
  anchor: string | null
  title: string
  /** Ancestor path below the book, without repeating the title. */
  ancestors: string[]
  excerpt: ExcerptPart[]
  scope: Scope
  kind: PageKind
  filterKind: FilterKind
}

// ---- Pagefind surface we use (1.5.x) -----------------------------------------------------------------------------
type PagefindData = {
  url: string
  excerpt: string
  meta: { title?: string; breadcrumbs?: string; anchor?: string; targetId?: string; kind?: string }
  filters: Record<string, string[]>
}
type PagefindResult = { id: string; score: number; data: () => Promise<PagefindData> }
type PagefindResponse = { results: PagefindResult[] }
type PagefindInstance = {
  search: (term: string, options?: { filters?: Record<string, string> }) => Promise<PagefindResponse>
  destroy: () => Promise<void>
}
type PagefindModule = { createInstance: (options: Record<string, unknown>) => PagefindInstance }

// Title matches outrank prose; breadcrumbs and ids are not ranked text. Shorter records (one heading's section)
// are preferred over long ones, which keeps an entry's own page above incidental mentions.
const RANKING = { metaWeights: { title: 10, breadcrumbs: 0, targetId: 0, kind: 0, anchor: 0 }, pageLength: 1 }
const EXCERPT_WORDS = 28

let versionPromise: Promise<string> | null = null
let instancePromise: Promise<PagefindInstance> | null = null
let attempt = 0

/** The content version is fetched once from the server (the manifest is never shipped to the browser). */
async function contentVersion(): Promise<string> {
  if (!versionPromise) {
    versionPromise = getContentVersionFn().catch((e) => {
      versionPromise = null
      throw e
    })
  }
  return versionPromise
}

function instance(): Promise<PagefindInstance> {
  if (!instancePromise) {
    instancePromise = (async () => {
      const version = await contentVersion()
      const base = `/_content/${version}/search/`
      // A failed module import is cached by URL, so a retry asks for a distinct URL. Absolute, because the Vite dev
      // server rewrites root-relative dynamic imports to `?import` and refuses to serve /public files that way.
      const url = new URL(`${base}pagefind.js${attempt ? `?retry=${attempt}` : ''}`, window.location.origin).href
      const mod = (await import(/* @vite-ignore */ url)) as PagefindModule
      return mod.createInstance({ basePath: base, excerptLength: EXCERPT_WORDS, ranking: RANKING })
    })()
    const pending = instancePromise
    pending.catch(() => { if (instancePromise === pending) resetSearch() })
  }
  return instancePromise
}

/** Drop the loaded engine after a failure so the next search (Retry) loads it again instead of reusing the failure. */
export function resetSearch() {
  const old = instancePromise
  instancePromise = null
  attempt++
  old?.then((i) => i.destroy()).catch(() => {})
}

/** Start loading the engine without waiting (palette open, /search mount). */
export function warmSearch() {
  void instance().catch(() => {})
}

async function run(query: string, filters: Record<string, string>): Promise<PagefindResult[]> {
  const pf = await instance()
  try {
    const res = await pf.search(query, { filters })
    return [...res.results].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  } catch (e) {
    // Pagefind reports an index that failed to load by rejecting search(); never cache that as "no results".
    if (instancePromise && await instancePromise.catch(() => null) === pf) resetSearch()
    throw e
  }
}

const BOOK_SEGMENTS = new Set(['Player rules', 'GM guide', 'Worlds', 'Alaria'])

function ancestorsOf(breadcrumbs: string, title: string): string[] {
  const parts = breadcrumbs.split(' › ').map((s) => s.trim()).filter(Boolean)
  while (parts.length && BOOK_SEGMENTS.has(parts[0])) parts.shift()
  const out: string[] = []
  for (const p of parts) if (out[out.length - 1] !== p) out.push(p)
  if (out[out.length - 1] === title) out.pop()
  return out
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" }
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, e: string) => ENTITIES[e])

/** Pagefind's excerpt is text with `<mark>` around matching words; keep those marks and nothing else as markup. */
function excerptParts(html: string): ExcerptPart[] {
  const parts: ExcerptPart[] = []
  const re = /<mark>([\s\S]*?)<\/mark>/g
  let last = 0
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m.index > last) parts.push({ text: decode(html.slice(last, m.index).replace(/<[^>]*>/g, '')), mark: false })
    parts.push({ text: decode(m[1].replace(/<[^>]*>/g, '')), mark: true })
    last = re.lastIndex
  }
  if (last < html.length) parts.push({ text: decode(html.slice(last).replace(/<[^>]*>/g, '')), mark: false })
  // Pagefind marks the word with its trailing punctuation ("grapple,"); keep the punctuation outside the mark.
  return parts.flatMap((p) => {
    if (!p.mark) return [p]
    const m = /^(.*?[\p{L}\p{N}])([^\p{L}\p{N}]*)$/u.exec(p.text)
    return m && m[2] ? [{ text: m[1], mark: true }, { text: m[2], mark: false }] : [p]
  })
}

async function toHit(r: PagefindResult): Promise<SearchHit> {
  const d = await r.data()
  const title = d.meta.title ?? d.url
  const [path, hash] = d.url.split('#')
  return {
    id: r.id,
    href: d.url,
    path,
    anchor: d.meta.anchor || hash || null,
    title,
    ancestors: ancestorsOf(d.meta.breadcrumbs ?? '', title),
    excerpt: excerptParts(d.excerpt),
    scope: (d.filters.scope?.[0] ?? 'player') as Scope,
    kind: (d.meta.kind ?? 'chapter') as PageKind,
    filterKind: (d.filters.filterKind?.[0] ?? 'rules') as FilterKind,
  }
}

function filtersFor(scope: SearchScope, kind: SearchKind | null): Record<string, string> {
  const f: Record<string, string> = {}
  if (scope !== 'all') f.scope = scope
  if (kind) f.filterKind = kind
  return f
}

export type PaletteGroup = { scope: Scope; label: string; total: number; hits: SearchHit[] }
export type PaletteResults = { total: number; groups: PaletteGroup[] }

/**
 * Palette search: each corpus is searched with its own scope filter (identical scores to an unfiltered search),
 * the top `perGroup` of each kept, and groups ordered by their best result's score.
 */
export async function searchGrouped(query: string, scope: SearchScope, perGroup = 5): Promise<PaletteResults> {
  const corpora = scope === 'all' ? CORPORA : CORPORA.filter((c) => c.scope === scope)
  const runs = await Promise.all(corpora.map((c) => run(query, filtersFor(c.scope, null))))
  const groups = await Promise.all(
    corpora.map(async (c, i) => ({
      scope: c.scope,
      label: c.label,
      total: runs[i].length,
      best: runs[i][0]?.score ?? -Infinity,
      hits: await Promise.all(runs[i].slice(0, perGroup).map(toHit)),
    })),
  )
  const kept = groups.filter((g) => g.total > 0).sort((a, b) => b.best - a.best)
  return { total: kept.reduce((n, g) => n + g.total, 0), groups: kept.map(({ best: _best, ...g }) => g) }
}

export type PageResults = { total: number; hits: SearchHit[] }

/** Results page: one ranked list under the scope and kind filters; only the requested page's records are loaded. */
export async function searchPage(query: string, scope: SearchScope, kind: SearchKind | null, page: number, perPage = 20): Promise<PageResults> {
  const results = await run(query, filtersFor(scope, kind))
  const start = (page - 1) * perPage
  return { total: results.length, hits: await Promise.all(results.slice(start, start + perPage).map(toHit)) }
}

/** The /search URL for a query, scope and kind. */
export function searchHref(q: string, scope: SearchScope = 'all', kind: SearchKind | null = null, page = 1): string {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (scope !== 'all') p.set('scope', scope)
  if (kind) p.set('kind', kind)
  if (page > 1) p.set('page', String(page))
  const s = p.toString()
  return s ? `/search?${s}` : '/search'
}

/**
 * After navigating to a result: focus the exact heading (or the page H1) once the destination has rendered.
 * Polls briefly because the route loader resolves after navigate() returns.
 */
export function focusDestination(path: string, anchor: string | null) {
  const deadline = Date.now() + 5000
  const tick = () => {
    const onPage = window.location.pathname.replace(/\/+$/, '') === path.replace(/\/+$/, '')
    const el = onPage
      ? anchor
        ? document.getElementById(anchor)
        : document.querySelector<HTMLElement>('#main-content h1')
      : null
    if (el) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
      el.scrollIntoView({ block: 'start' })
      el.focus({ preventScroll: true })
      return
    }
    if (Date.now() < deadline) setTimeout(tick, 50)
  }
  setTimeout(tick, 0)
}
