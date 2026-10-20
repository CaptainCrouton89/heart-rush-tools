// Derived artifacts: catalogues, play catalogues, previews, glossary, search records.
import type { Draft } from './collect.ts'
import { RACE_EFFECTS } from './race-effects.ts'
import { blockText, inlineText, wordCount } from './md.ts'
import { excerptWords, firstSentence } from './util.ts'
import { targetIdOf } from './link.ts'
import type {
  Block, CatalogueEntry, CatalogueFile, CatalogueKind, Crumb, Facet, FilterKind, GlossaryTarget, Page, PlayCondition, PlayRace, PlayTalent,
  PreviewFile, RaceFacets, SearchRecord, TalentFacets,
} from './types.ts'
import { SCHEMA_VERSION } from './types.ts'
import { stem } from './util.ts'

export const NOT_SPECIFIED = 'unspecified'

export function filterKindOf(p: Page): FilterKind {
  if (p.kind === 'talent') return 'talents'
  if (p.kind === 'spell') return 'spells'
  if (p.kind === 'race') return 'kin'
  if (p.scope === 'world:alaria') return 'world'
  return 'rules'
}

// ---- Section helpers ------------------------------------------------------------
/** Top-level blocks of the section starting at heading `id` (through nested subsections), heading excluded. */
export function sectionBlocks(page: Page, id: string): Block[] {
  const i = page.body.findIndex((b) => b.type === 'heading' && b.id === id)
  if (i < 0) return []
  const depth = (page.body[i] as Extract<Block, { type: 'heading' }>).depth
  const out: Block[] = []
  for (let j = i + 1; j < page.body.length; j++) {
    const b = page.body[j]
    if (b.type === 'heading' && b.depth <= depth) break
    out.push(b)
  }
  return out
}

/** Blocks of the section before its first sub-heading. */
function leadBlocks(blocks: Block[]): Block[] {
  const k = blocks.findIndex((b) => b.type === 'heading')
  return k < 0 ? blocks : blocks.slice(0, k)
}

// ---- Catalogues -----------------------------------------------------------------------
const label = (v: string) => (v === NOT_SPECIFIED ? 'Not specified' : v)

function facet(key: string, entries: CatalogueEntry[], get: (e: CatalogueEntry) => string[]): Facet {
  const counts = new Map<string, number>()
  for (const e of entries) {
    const vs = get(e)
    for (const v of vs.length ? new Set(vs) : [NOT_SPECIFIED]) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const values = [...counts].sort((a, b) => (a[0] === NOT_SPECIFIED ? 1 : b[0] === NOT_SPECIFIED ? -1 : a[0].localeCompare(b[0])))
    .map(([value, count]) => ({ value, label: label(value), count }))
  return { key, values }
}

export function buildCatalogue(kind: CatalogueKind, drafts: Draft[], version: string): CatalogueFile {
  const members = drafts.filter((d) => (kind === 'talents' ? d.page.kind === 'talent' && (d.page.facets as TalentFacets).collection !== 'spells' : kind === 'spells' ? d.page.kind === 'spell' : d.page.kind === 'race'))
  const entries: CatalogueEntry[] = members.map((d) => ({
    id: d.page.id, path: d.page.path, title: d.page.title,
    description: kind === 'kin-culture' ? d.page.description : firstSentence(blockText(leadBlocks(d.page.body)), 200) || null,
    aliases: d.page.aliases, rawMetadata: d.page.rawMetadata, facets: d.page.facets as TalentFacets | RaceFacets, searchText: blockText(d.page.body),
  }))
  entries.sort((a, b) => a.title.localeCompare(b.title))
  const f = (e: CatalogueEntry) => e.facets as TalentFacets
  const facets: Facet[] = kind === 'kin-culture'
    ? [facet('size', entries, (e) => ((e.facets as RaceFacets).size ? [(e.facets as RaceFacets).size!] : []))]
    : kind === 'talents'
      ? [facet('collection', entries, (e) => [f(e).collection]), facet('abilityTypes', entries, (e) => f(e).abilityTypes), facet('traditions', entries, (e) => f(e).traditions), facet('timing', entries, (e) => f(e).timing)]
      : [facet('elements', entries, (e) => f(e).elements), facet('abilityTypes', entries, (e) => f(e).abilityTypes), facet('timing', entries, (e) => f(e).timing), facet('ongoing', entries, (e) => (f(e).ongoing === null ? [] : [String(f(e).ongoing)]))]
  return { schemaVersion: SCHEMA_VERSION, contentVersion: version, kind, entries, facets }
}

// ---- Previews --------------------------------------------------------------------------------
export function buildPreview(d: Draft, anchor: string | null, version: string): PreviewFile {
  const p = d.page
  let title = p.title
  let blocks: Block[] = p.body
  const crumbs: Crumb[] = [...p.breadcrumbs, { title: p.title, path: p.path }]
  if (anchor) {
    const h = p.headings.find((x) => x.id === anchor)!
    title = h.text
    blocks = sectionBlocks(p, anchor)
  }
  const ex = excerptWords(blockText(blocks.length ? blocks : []), 120)
  const text = ex.text || p.description || ''
  return { schemaVersion: SCHEMA_VERSION, contentVersion: version, targetId: targetIdOf(p.id, anchor), path: p.path, anchor, title, breadcrumbs: anchor ? crumbs : p.breadcrumbs, excerptText: text, truncated: ex.truncated }
}

// ---- Glossary -----------------------------------------------------------------------------------
export function buildGlossary(drafts: Draft[]): Record<string, GlossaryTarget[]> {
  const terms: Record<string, GlossaryTarget[]> = {}
  const add = (term: string, t: GlossaryTarget) => {
    const k = term.toLowerCase().trim()
    if (!k) return
    const list = (terms[k] ??= [])
    if (!list.some((x) => x.id === t.id)) list.push(t)
  }
  for (const d of drafts) {
    const p = d.page
    if (p.scope === 'world:alaria') continue
    if (p.kind === 'talent' || p.kind === 'spell' || p.kind === 'race') {
      add(p.title, { id: targetIdOf(p.id, null), path: p.path, anchor: null, title: p.title, kind: p.kind, scope: p.scope })
      continue
    }
    if (p.kind === 'chapter' || p.kind === 'catalogue') {
      add(p.title, { id: targetIdOf(p.id, null), path: p.path, anchor: null, title: p.title, kind: p.kind, scope: p.scope })
      for (const a of p.aliases) add(a, { id: targetIdOf(p.id, null), path: p.path, anchor: null, title: p.title, kind: p.kind, scope: p.scope })
      for (const h of p.headings) if (h.depth <= 3) add(h.text, { id: targetIdOf(p.id, h.id), path: p.path, anchor: h.id, title: h.text, kind: 'heading', scope: p.scope })
    }
  }
  return Object.fromEntries(Object.entries(terms).sort(([a], [b]) => a.localeCompare(b)))
}

// ---- Search records ---------------------------------------------------------------------------------
/** One record per destination anchor: page intro, each H2 intro, each H3 (with its deeper content). */
export function buildSearchRecords(d: Draft): SearchRecord[] {
  const p = d.page
  if (p.kind === 'landing' && !p.body.length) {
    return [{ targetId: p.id, path: p.path, anchor: null, title: p.title, aliases: p.aliases, breadcrumbs: p.breadcrumbs.map((c) => c.title), scope: p.scope, kind: p.kind, filterKind: filterKindOf(p), tags: p.tags, text: p.title }]
  }
  const crumbs = p.breadcrumbs.map((c) => c.title)
  const base = { path: p.path, scope: p.scope, kind: p.kind, filterKind: filterKindOf(p), tags: p.tags }
  const out: SearchRecord[] = []
  const lead = leadBlocks(p.body)
  out.push({ ...base, targetId: p.id, anchor: null, title: p.title, aliases: p.aliases, breadcrumbs: crumbs, text: blockText(lead) })
  const hs = p.body.filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading')
  const stack: string[] = []
  p.body.forEach((b, i) => {
    if (b.type !== 'heading' || b.depth > 3) return
    while (stack.length >= b.depth - 1) stack.pop()
    stack.push(inlineText(b.children))
    // text: through deeper headings, until a heading of depth <= this, or (for H2) the first H3 child
    const blocks: Block[] = []
    for (let j = i + 1; j < p.body.length; j++) {
      const n = p.body[j]
      if (n.type === 'heading' && (n.depth <= b.depth || (b.depth === 2 && n.depth === 3))) break
      blocks.push(n)
    }
    const text = blockText(blocks)
    const anc = stack.slice(0, -1)
    out.push({ ...base, targetId: targetIdOf(p.id, b.id), anchor: b.id, title: inlineText(b.children), aliases: [], breadcrumbs: [...crumbs, p.title, ...anc], text })
  })
  void hs
  return out
}

// ---- Play catalogues -------------------------------------------------------------------------------------
const lcFirst = (s: string) => s.toLowerCase()

export function buildPlayTalents(drafts: Draft[]): PlayTalent[] {
  return drafts.filter((d) => d.page.kind === 'talent' || d.page.kind === 'spell').map((d): PlayTalent => {
    const f = d.page.facets as TalentFacets
    const destiny = d.page.headings.find((h) => h.text === 'Destiny Level')
    const destinyIdx = destiny ? d.page.body.findIndex((b) => b.type === 'heading' && b.id === destiny.id) : -1
    const bodyBlocks = destinyIdx >= 0 ? d.page.body.slice(0, destinyIdx) : d.page.body
    const t: PlayTalent = {
      id: d.page.id, path: d.page.path, title: d.page.title,
      category: f.collection === 'spells' ? 'elemental' : f.collection,
      frequency: f.abilityTypes[0] ? lcFirst(f.abilityTypes[0]) : null,
      body: blockText(bodyBlocks).trim(),
      destiny: destiny ? blockText(sectionBlocks(d.page, destiny.id)).trim() || null : null,
    }
    if (f.elements.length) { t.element = f.elements[0]; (t as PlayTalent & { elements?: string[] }).elements = f.elements }
    return t
  }).sort((a, b) => a.title.localeCompare(b.title))
}

const abilityMarker = /^(\w+) ability/i
function abilityOf(page: Page, headingId: string, title: string): { title: string; frequency: string | null; body: string } | null {
  const blocks = sectionBlocks(page, headingId)
  const first = blocks.find((b) => b.type === 'paragraph')
  if (!first || first.type !== 'paragraph') return null
  const lead = first.children[0]
  if (!lead || lead.type !== 'strong') return null
  const m = abilityMarker.exec(inlineText(lead.children))
  if (!m) return null
  const text = blockText(blocks.filter((b) => b.type !== 'heading')).replace(/^[^\n]*?ability\.?\*?\*?\s*/i, '').trim()
  return { title, frequency: m[1].toLowerCase(), body: text }
}

function aspectsOf(page: Page, headingId: string): string[] {
  const out: string[] = []
  for (const b of sectionBlocks(page, headingId)) if (b.type === 'list') for (const li of b.children) out.push(blockText(li.children).trim())
  return out
}

export function buildPlayRaces(drafts: Draft[]): PlayRace[] {
  return drafts.filter((d) => d.page.kind === 'race').map((d): PlayRace => {
    const p = d.page
    const hs = p.headings
    const race: PlayRace = { id: p.id, path: p.path, title: p.title, size: (p.facets as RaceFacets).size, image: p.image?.src ?? null, aspects: [], abilities: [], subraces: [], effects: RACE_EFFECTS[d.race!.stem] ?? [] }
    for (const h of hs.filter((x) => x.depth === 2)) {
      const kids = hs.filter((x) => x.parentId === h.id)
      const isSubrace = kids.some((k) => k.text === 'Aspects')
      if (h.text === 'Aspects') { race.aspects.push(...aspectsOf(p, h.id)); continue }
      if (h.text === 'Vitals') continue
      if (isSubrace) {
        const aspectsH = kids.find((k) => k.text === 'Aspects')!
        const abilities = kids.filter((k) => k.text !== 'Aspects').map((k) => abilityOf(p, k.id, k.text)).filter((x): x is NonNullable<typeof x> => !!x)
        race.subraces.push({ id: `${p.id}~${h.id}`, title: h.text, aspects: aspectsOf(p, aspectsH.id), abilities })
        continue
      }
      const a = abilityOf(p, h.id, h.text)
      if (a) race.abilities.push(a)
    }
    return race
  }).sort((a, b) => a.title.localeCompare(b.title))
}

const CONDITION_PENALTIES: Record<string, string[] | 'all'> = {
  dazed: ['cunning'], weakened: ['might'], 'off-balanced': ['agility'], shaken: ['presence'], poisoned: 'all',
}

export function buildPlayConditions(drafts: Draft[]): PlayCondition[] {
  const d = drafts.find((x) => x.page.path === '/player/conditions')
  if (!d) throw new Error('Conditions chapter missing')
  const out: PlayCondition[] = []
  for (const h of d.page.headings.filter((x) => x.depth === 3)) {
    const blocks = sectionBlocks(d.page, h.id)
    const tagBlock = blocks[0]
    const tag = tagBlock?.type === 'paragraph' && tagBlock.children[0]?.type === 'emphasis' ? inlineText(tagBlock.children).toLowerCase() : ''
    const isTag = /^(leveled|fading|ongoing)([. ]|$)/.test(tag)
    const body = blockText(isTag ? blocks.slice(1) : blocks).trim()
    const key = h.id
    const penalizes = CONDITION_PENALTIES[key] ?? null
    let situational: string | null = null
    if (!penalizes) {
      const sentence = body.replace(/\n/g, ' ').split(/(?<=\.)\s+/).find((s) => /disadvantage|D\d/i.test(s))
      situational = sentence ?? null
    }
    out.push({
      id: targetIdOf(d.page.id, h.id), path: `${d.page.path}#${h.id}`, title: h.text,
      leveled: tag.includes('leveled'), fading: tag.includes('fading'), ongoing: tag.includes('ongoing'), penalizes, situational, body,
    })
  }
  return out
}

export { stem, wordCount }
