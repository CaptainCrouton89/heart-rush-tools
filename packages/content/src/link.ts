// Link resolution: legacy #anchors, relative .md links (Alaria), character-sheet rewrite, bounded term cross-references.
import { posix } from 'node:path'
import { slug as ghSlug } from 'github-slugger'
import type { Draft } from './collect.ts'
import { LINK_BASE_OVERRIDES, LINK_FIXES, LINK_REWRITES, SHEET_URL_PREFIX, TERM_ALIASES } from './sources.ts'
import type { Block, CrossRef, Diagnostic, Inline, LinkTarget } from './types.ts'
import { inlineText } from './md.ts'

export const targetIdOf = (pageId: string, anchor: string | null) => (anchor ? `${pageId}~${anchor}` : pageId)

type Hit = { draft: Draft; anchor: string | null }

export function resolveLinks(drafts: Draft[], characterSheetUrl: string, diag: (d: Diagnostic) => void) {
  const byFile = new Map<string, Draft>()
  const byPath = new Map<string, Draft>()
  for (const d of drafts) { byPath.set(d.page.path, d); for (const f of d.files) if (!byFile.has(f)) byFile.set(f, d) }

  // Old-app style slugs: chapter title/nav title -> page; every heading text -> (page, heading id).
  const pageSlugs = new Map<string, Draft[]>()
  const headSlugs = new Map<string, Hit[]>()
  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => { const a = m.get(k) ?? []; a.push(v); m.set(k, a) }
  for (const d of drafts) {
    if (d.page.scope === 'world:alaria') continue
    for (const t of new Set([d.page.title, d.page.navTitle])) push(pageSlugs, ghSlug(t), d)
    if (d.page.kind === 'chapter' || d.page.kind === 'catalogue') for (const h of d.page.headings) push(headSlugs, ghSlug(h.text), { draft: d, anchor: h.id })
  }

  function anchorLookup(from: Draft, slug: string): Hit | null {
    const pages = pageSlugs.get(slug)
    const heads = headSlugs.get(slug)
    const own = heads?.find((h) => h.draft === from)
    if (own) return own
    // a chapter or catalogue of that name beats a same-named heading elsewhere
    const chapters = pages?.filter((p) => p.page.kind === 'chapter' || p.page.kind === 'catalogue')
    if (chapters?.length) return { draft: chapters[0], anchor: null }
    if (heads?.length === 1) return heads[0]
    if (heads && heads.length > 1) {
      const sameScope = heads.filter((h) => h.draft.page.scope === from.page.scope)
      if (sameScope.length === 1) return sameScope[0]
    }
    return null
  }

  function resolveRelative(from: Draft, url: string): Hit | null {
    const [rawPath, frag] = url.split('#')
    let target: Draft | undefined
    if (!rawPath) target = from
    else {
      let dec = decodeURIComponent(rawPath)
      for (const [bad, good] of Object.entries(LINK_REWRITES)) dec = dec.replace(bad, good)
      const base = LINK_BASE_OVERRIDES[from.files[0]] ?? posix.dirname(from.files[0])
      const rel = LINK_FIXES[dec] ?? posix.normalize(posix.join(base, dec))
      target = byFile.get(rel)
    }
    if (!target) return null
    let anchor: string | null = null
    if (frag) {
      const s = decodeURIComponent(frag)
      anchor = target.page.headings.find((h) => h.id === s || h.id === ghSlug(s))?.id ?? null
    }
    return { draft: target, anchor }
  }

  const targetOf = (hit: Hit): LinkTarget => ({
    id: hit.draft.page.id, path: hit.draft.page.path, anchor: hit.anchor, previewId: targetIdOf(hit.draft.page.id, hit.anchor),
  })

  let explicit = 0, unresolved = 0, sheet = 0, external = 0
  const unresolvedList: string[] = []

  function walkInline(d: Draft, nodes: Inline[], blockId: string, line: number, refs: CrossRef[]): Inline[] {
    return nodes.map((n): Inline => {
      if (n.type === 'link') {
        const children = walkInline(d, n.children, blockId, line, refs)
        let url = n.url
        if (url.startsWith(SHEET_URL_PREFIX)) { sheet++; return { ...n, url: characterSheetUrl, children } }
        if (n.external) { external++; return { ...n, children } }
        const hit = url.startsWith('#') ? anchorLookup(d, url.slice(1)) : resolveRelative(d, url)
        if (!hit) {
          unresolved++
          const msg = `Unresolved link "${url}" (${inlineText(n.children).slice(0, 40)})`
          unresolvedList.push(`${d.files[0]}:${line}  ${url}`)
          diag({ level: 'warn', code: 'unresolved-link', message: msg, source: { path: d.files[0], line } })
          // an unresolved link is never rendered as a working destination: keep the label as text
          return { type: 'link', url: '', external: false, target: null, origin: 'explicit', children }
        }
        explicit++
        const target = targetOf(hit)
        refs.push({ sourceNodeId: blockId, targetId: target.id, path: target.path, anchor: target.anchor, label: inlineText(n.children), previewId: target.previewId, origin: 'explicit' })
        return { ...n, url: target.path + (target.anchor ? `#${target.anchor}` : ''), target, children }
      }
      if ('children' in n) return { ...n, children: walkInline(d, n.children, blockId, line, refs) } as Inline
      return n
    })
  }

  function walkBlocks(d: Draft, bs: Block[], refs: CrossRef[]) {
    for (const b of bs) {
      switch (b.type) {
        case 'paragraph': case 'heading': b.children = walkInline(d, b.children, b.id, b.range[0], refs); break
        case 'list': for (const li of b.children) walkBlocks(d, li.children, refs); break
        case 'table':
          b.header = b.header.map((c) => walkInline(d, c, b.id, b.range[0], refs))
          b.rows = b.rows.map((r) => r.map((c) => walkInline(d, c, b.id, b.range[0], refs)))
          break
        case 'blockquote': case 'callout': walkBlocks(d, b.children, refs); break
      }
    }
  }

  for (const d of drafts) {
    const refs: CrossRef[] = []
    walkBlocks(d, d.page.body, refs)
    d.page.crossRefs = refs
    // unresolved links were turned into url '' — convert them to plain text children for a clean tree
    stripDead(d.page.body)
  }
  return { explicit, unresolved, sheet, external, unresolvedList }
}

function stripDead(bs: Block[]) {
  const fix = (nodes: Inline[]): Inline[] => nodes.flatMap((n): Inline[] => {
    if (n.type === 'link' && n.url === '') return fix(n.children)
    if ('children' in n) return [{ ...n, children: fix(n.children) } as Inline]
    return [n]
  })
  for (const b of bs) {
    switch (b.type) {
      case 'paragraph': case 'heading': b.children = fix(b.children); break
      case 'list': for (const li of b.children) stripDead(li.children); break
      case 'table': b.header = b.header.map(fix); b.rows = b.rows.map((r) => r.map(fix)); break
      case 'blockquote': case 'callout': stripDead(b.children); break
    }
  }
}

// ---- Term cross-references (rules prose only) ---------------------------------------------------
export type TermTarget = { terms: string[]; path: string; anchor: string | null; caseSensitive: boolean }

export function buildTermTargets(drafts: Draft[], diag: (d: Diagnostic) => void): TermTarget[] {
  const out: TermTarget[] = []
  const byPath = new Map(drafts.map((d) => [d.page.path, d]))
  for (const t of TERM_ALIASES) {
    const d = byPath.get(t.target[0])
    if (!d || !d.page.headings.some((h) => h.id === t.target[1])) throw new Error(`TERM_ALIASES target missing: ${t.target.join('#')}`)
    out.push({ terms: t.terms, path: t.target[0], anchor: t.target[1], caseSensitive: false })
  }
  // Conditions: one per H3 under the Conditions chapter.
  const cond = byPath.get('/player/conditions')
  const AMBIGUOUS = new Set(['hidden', 'mute', 'obscured', 'highground', 'burning', 'slowed', 'poisoned'])
  const skipped: string[] = []
  for (const h of cond?.page.headings.filter((x) => x.depth === 3) ?? []) {
    if (AMBIGUOUS.has(h.text.toLowerCase())) { skipped.push(h.text); continue }
    out.push({ terms: [h.text.toLowerCase()], path: '/player/conditions', anchor: h.id, caseSensitive: false })
  }
  if (skipped.length) diag({ level: 'info', code: 'term-ambiguous', message: `Condition names left unlinked because the word is also ordinary prose: ${skipped.join(', ')}` })
  // Talents and spells by full multi-word title, case-sensitive.
  const seen = new Map<string, string[]>()
  for (const d of drafts) if (d.page.kind === 'talent' || d.page.kind === 'spell') {
    if (d.page.title.trim().split(/\s+/).length < 2) continue
    const a = seen.get(d.page.title) ?? []; a.push(d.page.path); seen.set(d.page.title, a)
  }
  for (const [title, paths] of seen) {
    if (paths.length > 1) { diag({ level: 'warn', code: 'term-ambiguous', message: `"${title}" names ${paths.length} entries (${paths.join(', ')}); left unlinked` }); continue }
    out.push({ terms: [title], path: paths[0], anchor: null, caseSensitive: true })
  }
  return out
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function applyTerms(drafts: Draft[], terms: TermTarget[]): number {
  const entries = terms.flatMap((t) => t.terms.map((term) => ({ term, t }))).sort((a, b) => b.term.length - a.term.length)
  const ci = new RegExp(`(?<![\\w-])(${entries.filter((e) => !e.t.caseSensitive).map((e) => esc(e.term)).join('|')})(?![\\w-])`, 'gi')
  const cs = new RegExp(`(?<![\\w-])(${entries.filter((e) => e.t.caseSensitive).map((e) => esc(e.term)).join('|')})(?![\\w-])`, 'g')
  const lookupCI = new Map(entries.filter((e) => !e.t.caseSensitive).map((e) => [e.term.toLowerCase(), e.t]))
  const lookupCS = new Map(entries.filter((e) => e.t.caseSensitive).map((e) => [e.term, e.t]))
  const byPath = new Map(drafts.map((d) => [d.page.path, d]))
  let n = 0
  for (const d of drafts) {
    if (!(d.page.kind === 'chapter' || d.page.kind === 'catalogue') || d.page.scope === 'world:alaria') continue
    let used = new Set<string>()
    const linkIn = (nodes: Inline[], blockId: string, refs: CrossRef[], skipTarget: (t: TermTarget) => boolean): Inline[] =>
      nodes.flatMap((node): Inline[] => {
        if (node.type === 'link' || node.type === 'code') return [node]
        if ('children' in node) return [{ ...node, children: linkIn(node.children, blockId, refs, skipTarget) } as Inline]
        if (node.type !== 'text') return [node]
        const out: Inline[] = []
        let text = node.value
        const matches: Array<{ index: number; len: number; t: TermTarget; label: string }> = []
        for (const [re, lk, key] of [[ci, lookupCI, (s: string) => s.toLowerCase()], [cs, lookupCS, (s: string) => s]] as const) {
          for (const m of text.matchAll(re)) {
            const t = lk.get(key(m[1]))!
            matches.push({ index: m.index, len: m[1].length, t, label: m[1] })
          }
        }
        matches.sort((a, b) => a.index - b.index || b.len - a.len)
        let last = 0
        for (const m of matches) {
          if (m.index < last) continue
          const id = `${m.t.path}#${m.t.anchor ?? ''}`
          if (used.has(id) || skipTarget(m.t)) continue
          used.add(id)
          const target = byPath.get(m.t.path)!
          const lt: LinkTarget = { id: target.page.id, path: m.t.path, anchor: m.t.anchor, previewId: targetIdOf(target.page.id, m.t.anchor) }
          if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
          out.push({ type: 'link', url: m.t.path + (m.t.anchor ? `#${m.t.anchor}` : ''), external: false, target: lt, origin: 'term', children: [{ type: 'text', value: m.label }] })
          refs_push(refs_of(d), { sourceNodeId: blockId, targetId: lt.id, path: lt.path, anchor: lt.anchor, label: m.label, previewId: lt.previewId, origin: 'term' })
          last = m.index + m.len; n++
        }
        if (last === 0) return [node]
        if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
        return out
      })
    const refs_of = (x: Draft) => x.page.crossRefs
    const refs_push = (a: CrossRef[], r: CrossRef) => { a.push(r) }
    let currentSection: string | null = null
    const walk = (bs: Block[], top: boolean) => {
      for (const b of bs) {
        if (b.type === 'heading') { if (top) { used = new Set(); currentSection = b.id } continue }
        const skip = (t: TermTarget) => d.page.path === t.path && (t.anchor === null || t.anchor === currentSection)
        switch (b.type) {
          case 'paragraph': b.children = linkIn(b.children, b.id, d.page.crossRefs, skip); break
          case 'list': for (const li of b.children) walk(li.children, false); break
          case 'table': break // tables: leave plain
          case 'blockquote': case 'callout': walk(b.children, false); break
        }
      }
    }
    walk(d.page.body, true)
  }
  return n
}
