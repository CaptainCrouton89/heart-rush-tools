// Catalogue list state, all of it in the URL: `q` (local search), `sort`, `page`, and one parameter per facet holding
// comma-separated values (`?element=Fire,Ice&type=Major`). Pure functions only; catalogue-page.tsx renders them.
//
// Matching: OR within a facet, AND across facets and the query. An entry with no value for a facet carries the
// compiler's `unspecified` value, shown as "Not specified". A facet value's count is the number of entries that
// would match if that value were added: computed under the query and every other facet's selection, ignoring the
// selection inside the value's own facet.
import type { CatalogueEntry, CatalogueFile } from '@heartrush/content/types'
import type { CatalogueConfig } from './config'

export const PAGE_SIZE = 30
export const NOT_SPECIFIED = 'unspecified'
export const SORTS = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
] as const
export type Sort = (typeof SORTS)[number]['value']

/**
 * The route's search params. The router's default parser reads `true` and `12` as JSON, so a value arrives as a
 * string, number or boolean; `toSearch` writes values in that same form so the URL stays `?page=2&ongoing=true`.
 */
export type SearchValue = string | number | boolean
export type CatalogueSearch = Partial<Record<string, SearchValue>>

/** validateSearch for the list routes: keeps only this catalogue's parameters, as primitives. */
export function validateCatalogueSearch(config: CatalogueConfig) {
  const keys = ['q', 'sort', 'page', ...config.facets.map((f) => f.param)]
  return (raw: Record<string, unknown>): CatalogueSearch => {
    const out: CatalogueSearch = {}
    for (const key of keys) {
      const value = raw[key]
      if (value === undefined || value === null || value === '') continue
      out[key] = Array.isArray(value) ? value.map(String).join(',') : typeof value === 'object' ? JSON.stringify(value) : (value as SearchValue)
    }
    return out
  }
}

/** A string the default parser would read back as a number or boolean is written as that value. */
function urlValue(value: string): SearchValue {
  if (value === 'true' || value === 'false') return value === 'true'
  if (/^-?\d+$/.test(value) && String(Number(value)) === value) return Number(value)
  return value
}

export type Selection = Record<string, string[]>

export type ParsedState = {
  query: string
  sort: Sort
  page: number
  selection: Selection
  /** Human-readable descriptions of URL values that matched nothing in this catalogue; they were ignored. */
  unavailable: string[]
}

/** Read the URL params against the catalogue's real facet values. Page is clamped later, once the result count is known. */
export function parseState(search: CatalogueSearch, config: CatalogueConfig, catalogue: CatalogueFile): ParsedState {
  const unavailable: string[] = []
  const selection: Selection = {}
  for (const def of config.facets) {
    const raw = search[def.param] === undefined ? '' : String(search[def.param])
    if (!raw) continue
    const known = new Set(catalogue.facets.find((f) => f.key === def.key)?.values.map((v) => v.value) ?? [])
    const picked: string[] = []
    for (const value of raw.split(',').map((v) => v.trim()).filter(Boolean)) {
      if (known.has(value)) {
        if (!picked.includes(value)) picked.push(value)
      } else unavailable.push(`${def.label} “${value}”`)
    }
    if (picked.length) selection[def.key] = picked
  }
  let sort: Sort = 'name'
  if (search.sort !== undefined) {
    const found = SORTS.find((s) => s.value === String(search.sort))
    if (found) sort = found.value
    else unavailable.push(`sort “${search.sort}”`)
  }
  let page = 1
  if (search.page !== undefined) {
    const n = Number(search.page)
    if (Number.isInteger(n) && n >= 1) page = n
    else unavailable.push(`page “${search.page}”`)
  }
  return { query: search.q === undefined ? '' : String(search.q), sort, page, selection, unavailable }
}

/** Selection + query + sort as URL params. Page is omitted (page 1) unless given. */
export function toSearch(config: CatalogueConfig, state: { query: string; sort: Sort; selection: Selection; page?: number }): CatalogueSearch {
  const out: CatalogueSearch = {}
  if (state.query) out.q = urlValue(state.query)
  if (state.sort !== 'name') out.sort = state.sort
  for (const def of config.facets) {
    const values = state.selection[def.key]
    if (values?.length) out[def.param] = urlValue(values.join(','))
  }
  if (state.page && state.page > 1) out.page = state.page
  return out
}

/** An entry's values for one facet; an absent field is `unspecified`. */
export function entryValues(entry: CatalogueEntry, key: string): string[] {
  const raw = (entry.facets as Record<string, unknown>)[key]
  const values = Array.isArray(raw) ? raw.map(String) : raw === null || raw === undefined ? [] : [String(raw)]
  return values.length ? values : [NOT_SPECIFIED]
}

/** Lowercase, strip diacritics, and turn punctuation into spaces, so "Gaeic-melody" and "gaeic melody" match. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
}

export type Indexed = { entry: CatalogueEntry; haystack: string; values: Record<string, string[]> }

export function indexEntries(catalogue: CatalogueFile, config: CatalogueConfig): Indexed[] {
  return catalogue.entries.map((entry) => ({
    entry,
    haystack: ` ${normalize([entry.title, ...entry.aliases, entry.searchText].join(' '))} `,
    values: Object.fromEntries(config.facets.map((f) => [f.key, entryValues(entry, f.key)])),
  }))
}

function matchesQuery(item: Indexed, terms: string[]) {
  return terms.every((t) => item.haystack.includes(t))
}

function matchesFacets(item: Indexed, selection: Selection, skipKey?: string) {
  for (const [key, picked] of Object.entries(selection)) {
    if (key === skipKey || picked.length === 0) continue
    if (!item.values[key]!.some((v) => picked.includes(v))) return false
  }
  return true
}

export type FacetView = { key: string; label: string; param: string; values: Array<{ value: string; label: string; count: number }> }

/** Results (sorted) and every facet value's count under the current query and the other facets' selections. */
export function compute(items: Indexed[], catalogue: CatalogueFile, config: CatalogueConfig, query: string, selection: Selection, sort: Sort) {
  const terms = normalize(query).split(' ').filter(Boolean)
  const queried = terms.length ? items.filter((i) => matchesQuery(i, terms)) : items
  const results = queried.filter((i) => matchesFacets(i, selection)).map((i) => i.entry)
  results.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }))
  if (sort === 'name-desc') results.reverse()

  const facets: FacetView[] = config.facets.map((def) => {
    const compiled = catalogue.facets.find((f) => f.key === def.key)
    const pool = queried.filter((i) => matchesFacets(i, selection, def.key))
    return {
      key: def.key,
      label: def.label,
      param: def.param,
      values: (compiled?.values ?? []).map((v) => ({
        value: v.value,
        label: def.valueLabel?.(v.value) ?? v.label,
        count: pool.filter((i) => i.values[def.key]!.includes(v.value)).length,
      })),
    }
  })
  return { results, facets }
}

export function selectedCount(selection: Selection) {
  return Object.values(selection).reduce((n, v) => n + v.length, 0)
}

export function toggle(selection: Selection, key: string, value: string): Selection {
  const current = selection[key] ?? []
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  const out = { ...selection }
  if (next.length) out[key] = next
  else delete out[key]
  return out
}
