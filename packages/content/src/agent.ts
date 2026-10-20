// Markdown + search for agents (rules.heartrush.party/md). Build side: buildAgentFiles copies each served page's
// source Markdown and records where every heading sits. Query side: pure functions over that index, used by the
// Worker routes in apps/rules/src/routes/md. Worker-safe: no node: imports, type-only imports of compiler types.
// Contract: the design document "design-rules-markdown-http".
import type { Page, Scope, SearchRecord } from './types.ts'

/** The part of a compiler draft the agent build reads (structural, so the Worker's typecheck does not pull in the compiler). */
type AgentDraft = { page: Page }

export const AGENT_UNIT_LIMIT = 24_000
const SNIPPET_CHARS = 280

// ---- Index (agent/index.json) ----------------------------------------------------------------------------
export type AgentSection = {
  anchor: string; text: string; depth: number; parentAnchor: string | null
  part: number; startLine: number; endLine: number; chars: number
}
export type AgentPage = {
  id: string; path: string; title: string; scope: Scope; kind: string
  breadcrumbs: string[]
  parts: Array<{ path: string; lineCount: number }>
  leadEndLine: number
  chars: number
  sections: AgentSection[]
}
export type AgentRecord = Omit<SearchRecord, 'filterKind'>
export type AgentIndex = { schemaVersion: 1; contentVersion: string; pages: AgentPage[]; records: AgentRecord[] }

export const agentSourceRel = (pageId: string, part: number) => `agent/sources/${pageId}.${part}.md`

/** Lowercase ASCII words separated by single spaces. */
export function normalizeText(s: string): string {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
const tokensOf = (s: string) => normalizeText(s).split(' ').filter(Boolean)

const linesOf = (text: string): string[] => {
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}
const textOfLines = (lines: string[], start: number, end: number) => lines.slice(start - 1, end).join('\n') + '\n'

// ---- Build ---------------------------------------------------------------------------------------------------
/**
 * Served pages are player and GM pages that have a source. `readText` returns the file as authored (LF endings);
 * link URLs starting with `sheetUrlPrefix` become `characterSheetUrl`, as on the rendered site.
 */
export function buildAgentFiles(
  drafts: AgentDraft[], records: SearchRecord[], contentVersion: string,
  readText: (rel: string) => string, characterSheetUrl: string, sheetUrlPrefix: string,
): { index: AgentIndex; files: Array<{ rel: string; text: string }> } {
  const sheetRe = new RegExp(sheetUrlPrefix.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '[^\\s)>\\]]*', 'g')
  const files: Array<{ rel: string; text: string }> = []
  const pages: AgentPage[] = []
  for (const d of drafts) {
    const p = d.page
    if ((p.scope !== 'player' && p.scope !== 'gm') || !p.source) continue
    const refs = p.sourceParts.length ? p.sourceParts : [p.source]
    const partLines = refs.map((r, i) => {
      const text = readText(r.path).replace(sheetRe, () => characterSheetUrl)
      files.push({ rel: agentSourceRel(p.id, i), text })
      return linesOf(text)
    })
    const parts = refs.map((r, i) => ({ path: r.path, lineCount: partLines[i].length }))

    // Locate each heading: the body heading block records its source lines; the cursor only moves forward through the parts.
    const ranges = new Map(p.body.flatMap((b) => (b.type === 'heading' ? [[b.id, b.range] as const] : [])))
    const sections: AgentSection[] = []
    let part = 0
    for (const h of p.headings) {
      const range = ranges.get(h.id)
      if (!range) throw new Error(`agent: ${p.id}: heading ${h.id} has no body block`)
      const want = normalizeText(h.text)
      for (;;) {
        if (part >= parts.length) throw new Error(`agent: ${p.id}: heading "${h.text}" (${h.id}) not found at lines ${range[0]}-${range[1]} of ${refs.map((r) => r.path).join(' or ')}`)
        if (normalizeText(partLines[part].slice(range[0] - 1, range[1]).join(' ')).includes(want)) break
        part++
      }
      sections.push({ anchor: h.id, text: h.text, depth: h.depth, parentAnchor: h.parentId, part, startLine: range[0], endLine: parts[part].lineCount, chars: 0 })
    }
    sections.forEach((s, i) => {
      for (let j = i + 1; j < sections.length && sections[j].part === s.part; j++) {
        if (sections[j].depth <= s.depth) { s.endLine = sections[j].startLine - 1; break }
      }
      s.chars = textOfLines(partLines[s.part], s.startLine, s.endLine).length
    })
    const first = sections.find((s) => s.part === 0)
    const leadEndLine = first ? first.startLine - 1 : parts[0].lineCount
    const chars = partLines.map((l) => textOfLines(l, 1, l.length).length).reduce((a, b) => a + b, 0) + (parts.length - 1)
    pages.push({ id: p.id, path: p.path, title: p.title, scope: p.scope, kind: p.kind, breadcrumbs: p.breadcrumbs.map((c) => c.title), parts, leadEndLine, chars, sections })
  }
  const served = new Set(pages.map((p) => p.path))
  const agentRecords = records.filter((r) => served.has(r.path)).map(({ filterKind: _drop, ...r }) => r)
  return { index: { schemaVersion: 1, contentVersion, pages, records: agentRecords }, files }
}

// ---- Query -----------------------------------------------------------------------------------------------------
export type AgentScope = 'all' | 'player' | 'gm'
export type AgentQuery = { q: string; tokens: string[]; scope: AgentScope; limit: number }

export function parseAgentQuery(params: URLSearchParams): { ok: true; query: AgentQuery } | { ok: false; message: string } {
  const raw = params.get('q')
  if (raw === null) return { ok: false, message: 'Missing required parameter q (2–200 characters).' }
  const q = raw.trim()
  if (q.length < 2 || q.length > 200) return { ok: false, message: 'q must be 2–200 characters after trimming.' }
  const all = tokensOf(q)
  if (all.length < 1 || all.length > 8) return { ok: false, message: 'q must contain 1–8 words (letters and digits).' }
  if (!all.some((t) => t.length >= 2)) return { ok: false, message: 'q must contain at least one word of 2 or more characters.' }
  const scope = params.get('scope') ?? 'all'
  if (scope !== 'all' && scope !== 'player' && scope !== 'gm') return { ok: false, message: 'scope must be one of all, player, gm.' }
  const limitRaw = params.get('limit')
  const limit = limitRaw === null ? 8 : /^\d+$/.test(limitRaw) ? Number(limitRaw) : NaN
  if (!(limit >= 1 && limit <= 20)) return { ok: false, message: 'limit must be an integer from 1 to 20.' }
  return { ok: true, query: { q, tokens: [...new Set(all)], scope, limit } }
}

type Prepared = {
  pages: Map<string, AgentPage>
  recs: Array<{ rec: AgentRecord; title: string; aliases: string[]; titleTokens: string[]; hay: string[] }>
}
const prepared = new WeakMap<AgentIndex, Prepared>()
function prepare(index: AgentIndex): Prepared {
  let pr = prepared.get(index)
  if (!pr) {
    pr = {
      pages: new Map(index.pages.map((p) => [p.path, p])),
      recs: index.records.map((rec) => ({
        rec, title: normalizeText(rec.title), aliases: rec.aliases.map(normalizeText), titleTokens: tokensOf(rec.title),
        hay: tokensOf([rec.title, ...rec.aliases, ...rec.tags, rec.text].join(' ')),
      })),
    }
    prepared.set(index, pr)
  }
  return pr
}

export type AgentHit = { rec: AgentRecord; score: number }
export function searchAgent(index: AgentIndex, query: AgentQuery): { total: number; hits: AgentHit[] } {
  const pr = prepare(index)
  const nq = normalizeText(query.q)
  const found: Array<AgentHit & { order: number }> = []
  pr.recs.forEach((r, order) => {
    if (query.scope !== 'all' && r.rec.scope !== query.scope) return
    if (!query.tokens.every((t) => r.hay.some((h) => h.startsWith(t)))) return
    let score = 0
    if (r.title === nq || r.aliases.includes(nq)) score = 1000
    else if (query.tokens.every((t) => r.titleTokens.some((h) => h.startsWith(t)))) score = 500
    score += Math.min(50, r.hay.filter((h) => query.tokens.some((t) => h.startsWith(t))).length)
    found.push({ rec: r.rec, score, order })
  })
  found.sort((a, b) => b.score - a.score || a.order - b.order)
  return { total: found.length, hits: found.slice(0, query.limit).map(({ rec, score }) => ({ rec, score })) }
}

// ---- Rendering ---------------------------------------------------------------------------------------------------
const fmt = (n: number) => n.toLocaleString('en-US')
const yaml = (s: string) => (/^[A-Za-z][A-Za-z0-9 ._/&,'()+–-]*$/.test(s) && !/^(true|false|null|yes|no|on|off)$/i.test(s) && !/ $/.test(s) ? s : JSON.stringify(s))
const frontMatter = (fields: Array<[string, string | number | null | string[]]>) =>
  '---\n' + fields.map(([k, v]) => (Array.isArray(v) ? `${k}:\n${v.join('\n')}` : `${k}: ${typeof v === 'number' ? v : yaml(v ?? '')}`)).join('\n') + '\n---\n'
const linkText = (s: string) => s.replace(/[[\]]/g, '\\$&')
const lineRange = (a: number, b: number) => `${a}–${b}`
const sourceItem = (path: string, a: number, b: number) => `  - path: ${yaml(path)}\n    lines: ${lineRange(a, b)}`

const readUrl = (origin: string, path: string, anchor: string | null) => `${origin}/md${path}${anchor ? `?section=${encodeURIComponent(anchor)}` : ''}`
const webUrl = (origin: string, path: string, anchor: string | null) => `${origin}${path}${anchor ? `#${anchor}` : ''}`

export function renderIndex(index: AgentIndex, origin: string): string {
  const row = (p: AgentPage) => `- [${linkText(p.title)}](${readUrl(origin, p.path, null)}) — ${fmt(p.chars)} chars`
  const list = (scope: Scope) => index.pages.filter((p) => p.scope === scope && (p.kind === 'chapter' || p.kind === 'catalogue')).map(row).join('\n')
  return frontMatter([['kind', 'index'], ['contentVersion', index.contentVersion]]) + `# Heart Rush rules (Markdown)

Pages are the rulebook's source Markdown, read by URL. Responses over ${fmt(AGENT_UNIT_LIMIT)} characters return an outline of linked sections instead.

- Search: ${origin}/md/search?q=<words>&scope=<all|player|gm>&limit=<1-20> (every word is a prefix match; results give a read URL)
- Read a page: ${origin}/md/<page path>, for example ${origin}/md/player/combat
- Read one section: ${origin}/md/<page path>?section=<section id>

Talents, spells and kin & culture entries are not listed here; find them by search (for example ?q=charge).

## Player rules

${list('player')}

## GM guide

${list('gm')}
`
}

function excerptOf(text: string, tokens: string[]): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  let pos = 0
  for (const m of flat.matchAll(/[A-Za-z0-9\u00C0-\u024F]+/g)) {
    const n = normalizeText(m[0])
    if (tokens.some((t) => n.startsWith(t))) { pos = m.index; break }
  }
  const before = flat.slice(0, pos)
  let start = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? ')) + 2
  if (start < 2) start = 0
  if (pos - start > SNIPPET_CHARS * 0.7) start = flat.lastIndexOf(' ', Math.max(0, pos - 40)) + 1
  let out = flat.slice(start, start + SNIPPET_CHARS)
  if (start + SNIPPET_CHARS < flat.length) out = out.replace(/\s+\S*$/, '') + '…'
  return (start > 0 ? '…' : '') + out
}

export function renderSearch(index: AgentIndex, query: AgentQuery, result: { total: number; hits: AgentHit[] }, origin: string): string {
  const head: Array<[string, string | number]> = [['kind', 'search'], ['query', query.q], ['scope', query.scope], ['total', result.total], ['shown', result.hits.length], ['contentVersion', index.contentVersion]]
  if (!result.total) {
    return frontMatter([...head.filter(([k]) => k !== 'total' && k !== 'shown'), ['results', 0]]) + `# Search: ${query.q}\n\nNo results for "${query.q}". Rulebook index: ${origin}/md\n`
  }
  const pr = prepare(index)
  const items = result.hits.map(({ rec }, i) => {
    const page = pr.pages.get(rec.path)!
    const sec = rec.anchor ? page.sections.find((s) => s.anchor === rec.anchor) : undefined
    if (rec.anchor && !sec) throw new Error(`agent: record ${rec.targetId} has no section`)
    const src = sec ? `${page.parts[sec.part].path} lines ${lineRange(sec.startLine, sec.endLine)}` : `${page.parts[0].path} lines ${lineRange(1, page.parts[0].lineCount)}`
    return `${i + 1}. **${rec.title}** — ${rec.breadcrumbs.join(' › ')}
   read: ${readUrl(origin, rec.path, rec.anchor)} (${fmt(sec ? sec.chars : page.chars)} chars)
   web: ${webUrl(origin, rec.path, rec.anchor)}
   source: ${src}
   excerpt (plain text): ${excerptOf(rec.text, query.tokens)}`
  })
  return frontMatter(head) + `# Search: ${query.q}\n\n${items.join('\n\n')}\n`
}

export function findAgentPage(index: AgentIndex, path: string): AgentPage | undefined {
  return prepare(index).pages.get(path)
}

/** Direct children of a page (`parentAnchor` null) or of a section, as read links. */
export function renderOutlineRows(page: AgentPage, parentAnchor: string | null, origin: string): string {
  return page.sections.filter((s) => s.parentAnchor === parentAnchor)
    .map((s) => `- [${linkText(s.text)}](${readUrl(origin, page.path, s.anchor)}) — H${s.depth}, ${fmt(s.chars)} chars`).join('\n')
}

/** The Markdown response for a page or one of its sections; null when the section does not exist. `readPart` returns a stored source part. */
export async function renderUnit(index: AgentIndex, page: AgentPage, sectionAnchor: string | null, origin: string, readPart: (part: number) => Promise<string>): Promise<string | null> {
  const sec = sectionAnchor === null ? null : page.sections.find((s) => s.anchor === sectionAnchor)
  if (sectionAnchor !== null && !sec) return null
  const chars = sec ? sec.chars : page.chars
  const hasChildren = page.sections.some((s) => s.parentAnchor === (sec ? sec.anchor : null))
  const outline = chars > AGENT_UNIT_LIMIT && hasChildren
  const crumbs = [...page.breadcrumbs, page.title]
  const ancestors: string[] = []
  for (let a = sec?.parentAnchor ?? null; a;) {
    const s = page.sections.find((x) => x.anchor === a)!
    ancestors.unshift(s.text); a = s.parentAnchor
  }
  const unitParts = sec ? [{ path: page.parts[sec.part].path, a: sec.startLine, b: sec.endLine }] : page.parts.map((p) => ({ path: p.path, a: 1, b: p.lineCount }))
  const fm = frontMatter([
    ['kind', 'page'], ['title', sec ? sec.text : page.title], ['breadcrumbs', [...crumbs, ...ancestors].join(' › ')],
    ['web', webUrl(origin, page.path, sec ? sec.anchor : null)],
    ['source', unitParts.map((u) => sourceItem(u.path, u.a, u.b))],
    ['mode', outline ? 'outline' : 'full'], ['chars', chars], ['contentVersion', index.contentVersion],
  ])
  if (!outline) {
    if (sec) return fm + textOfLines(linesOf(await readPart(sec.part)), sec.startLine, sec.endLine)
    const texts: string[] = []
    for (let i = 0; i < page.parts.length; i++) { const l = linesOf(await readPart(i)); texts.push(textOfLines(l, 1, l.length)) }
    return fm + texts.join('\n')
  }
  const lead = sec
    ? textOfLines(linesOf(await readPart(sec.part)), sec.startLine, page.sections.find((s) => s.parentAnchor === sec.anchor)!.startLine - 1)
    : textOfLines(linesOf(await readPart(0)), 1, page.leadEndLine)
  return fm + lead + `\n<!-- generated: sections of this unit; read each by URL -->\n\n${renderOutlineRows(page, sec ? sec.anchor : null, origin)}\n`
}

export function renderError(contentVersion: string, status: number, message: string, more = ''): string {
  return frontMatter([['kind', 'error'], ['status', status], ['contentVersion', contentVersion]]) + `# ${message}\n${more ? `\n${more.trim()}\n` : ''}`
}

export function agentResponse(body: string, status: number, contentVersion: string): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Content-Version': contentVersion,
      'Cache-Control': status === 503 ? 'no-store' : 'public, max-age=300',
    },
  })
}
