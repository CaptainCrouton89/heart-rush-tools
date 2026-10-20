import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { slug as ghSlug } from 'github-slugger'
import type { Root, RootContent, PhrasingContent, TableCell, ListItem as MdListItem } from 'mdast'
import type { Block, Inline, Heading, ListItem, Diagnostic } from './types.ts'

const parser = unified().use(remarkParse).use(remarkGfm)

export type Ctx = { file: string; lineOffset: number; diag: (d: Diagnostic) => void }

// ---- Dice ----------------------------------------------------------------------
const DICE = /(?<![\w-])(?:\d*d(?:2|3|4|5|6|8|10|12|20|100)(?:\s?[+-]\s?\d+)?|[AD]\+?\d{1,2})(?![\w])/g
const SIDES: Record<string, string> = { '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '8': 'eight', '10': 'ten', '12': 'twelve', '20': 'twenty', '100': 'hundred' }

export function diceLabel(s: string): string {
  const ad = /^([AD])\+?(\d+)$/.exec(s)
  if (ad) return `${ad[1] === 'A' ? 'advantage' : 'disadvantage'} ${ad[2]}`
  const m = /^(\d*)d(\d+)(?:\s?([+-])\s?(\d+))?$/.exec(s)!
  const n = m[1] || '1'
  const label = `${n} ${SIDES[m[2]]}-sided ${n === '1' ? 'die' : 'dice'}`
  return m[3] ? `${label} ${m[3] === '+' ? 'plus' : 'minus'} ${m[4]}` : label
}

function textNodes(value: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of value.matchAll(DICE)) {
    if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) })
    out.push({ type: 'dice', value: m[0], label: diceLabel(m[0]) })
    last = m.index + m[0].length
  }
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) })
  return out
}

// ---- Inline ------------------------------------------------------------------------
function inlines(nodes: PhrasingContent[], ctx: Ctx): Inline[] {
  const out: Inline[] = []
  for (const n of nodes) {
    const line = (n.position?.start.line ?? 1) + ctx.lineOffset
    switch (n.type) {
      case 'text': out.push(...textNodes(n.value)); break
      case 'emphasis': out.push({ type: 'emphasis', children: inlines(n.children, ctx) }); break
      case 'strong': out.push({ type: 'strong', children: inlines(n.children, ctx) }); break
      case 'delete': out.push({ type: 'delete', children: inlines(n.children, ctx) }); break
      case 'inlineCode': out.push({ type: 'code', value: n.value }); break
      case 'break': out.push({ type: 'lineBreak' }); break
      case 'link':
        out.push({ type: 'link', url: n.url, external: /^[a-z][a-z0-9+.-]*:/i.test(n.url), target: null, origin: 'explicit', children: inlines(n.children, ctx) })
        break
      case 'html':
        if (/^<br\s*\/?>$/i.test(n.value.trim())) out.push({ type: 'lineBreak' })
        else {
          ctx.diag({ level: 'warn', code: 'html', message: `Unsupported HTML kept as text: ${n.value}`, source: { path: ctx.file, line } })
          out.push({ type: 'text', value: n.value })
        }
        break
      case 'image':
        ctx.diag({ level: 'warn', code: 'inline-image', message: `Inline image rendered as alt text: ${n.url}`, source: { path: ctx.file, line } })
        out.push({ type: 'text', value: n.alt ?? '' })
        break
      default:
        ctx.diag({ level: 'warn', code: 'inline-node', message: `Unsupported inline ${n.type}`, source: { path: ctx.file, line } })
    }
  }
  return out
}

// ---- Blocks (ids assigned later in finalize) -----------------------------------------
type RawBlock = Block
const R = (n: { position?: { start: { line: number }; end: { line: number } } }, ctx: Ctx): [number, number] =>
  [(n.position?.start.line ?? 1) + ctx.lineOffset, (n.position?.end.line ?? 1) + ctx.lineOffset]

function cellInlines(c: TableCell, ctx: Ctx): Inline[] { return inlines(c.children, ctx) }

function listItem(li: MdListItem, ctx: Ctx): ListItem {
  return { type: 'listItem', id: '', range: R(li, ctx), checked: li.checked ?? null, children: blocks(li.children, ctx) }
}

function blocks(nodes: RootContent[], ctx: Ctx): RawBlock[] {
  const out: RawBlock[] = []
  for (const n of nodes) {
    const range = R(n, ctx)
    switch (n.type) {
      case 'heading': out.push({ type: 'heading', id: '', range, depth: n.depth, children: inlines(n.children, ctx) }); break
      case 'paragraph': {
        if (n.children.length === 1 && n.children[0].type === 'image') {
          out.push({ type: 'image', id: '', range, src: n.children[0].url, alt: n.children[0].alt ?? '', width: null, height: null })
        } else out.push({ type: 'paragraph', id: '', range, children: inlines(n.children, ctx) })
        break
      }
      case 'list': out.push({ type: 'list', id: '', range, ordered: !!n.ordered, start: n.ordered ? (n.start ?? 1) : null, children: n.children.map((li) => listItem(li, ctx)) }); break
      case 'table': out.push({
        type: 'table', id: '', range,
        align: (n.align ?? []).map((a) => a ?? null),
        header: n.children[0].children.map((c) => cellInlines(c, ctx)),
        rows: n.children.slice(1).map((r) => r.children.map((c) => cellInlines(c, ctx))),
      }); break
      case 'blockquote': out.push({ type: 'blockquote', id: '', range, children: blocks(n.children, ctx) }); break
      case 'code': out.push({ type: 'codeBlock', id: '', range, lang: n.lang ?? null, value: n.value }); break
      case 'thematicBreak': out.push({ type: 'thematicBreak', id: '', range }); break
      case 'html': {
        if (/^<br\s*\/?>$/i.test(n.value.trim())) break
        ctx.diag({ level: 'warn', code: 'html', message: `Unsupported HTML kept as text: ${n.value.slice(0, 80)}`, source: { path: ctx.file, line: range[0] } })
        out.push({ type: 'paragraph', id: '', range, children: [{ type: 'text', value: n.value }] })
        break
      }
      default:
        ctx.diag({ level: 'warn', code: 'block-node', message: `Unsupported block ${n.type} dropped`, source: { path: ctx.file, line: range[0] } })
    }
  }
  return out
}

// ---- Bracketed asides ---------------------------------------------------------------------
// `[[Title` ... `]]` spans lines. Parsed before markdown; inner text is parsed recursively.
function asideKind(title: string | null): 'example' | 'note' | 'warning' {
  if (title && /^example/i.test(title)) return 'example'
  if (title && /^warning/i.test(title)) return 'warning'
  return 'note'
}

export function parseMarkdown(text: string, ctx: Ctx): RawBlock[] {
  const lines = text.split('\n')
  const out: RawBlock[] = []
  let buf: string[] = []
  let bufStart = 0
  const flush = () => {
    if (buf.some((l) => l.trim())) {
      const tree = parser.parse(buf.join('\n')) as Root
      out.push(...blocks(tree.children, { ...ctx, lineOffset: ctx.lineOffset + bufStart }))
    }
    buf = []
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('[[')) {
      flush()
      let j = i
      while (j < lines.length && !lines[j].trimEnd().endsWith(']]')) j++
      if (j >= lines.length) {
        ctx.diag({ level: 'warn', code: 'aside-unclosed', message: 'Unclosed [[ aside; treated as text', source: { path: ctx.file, line: i + 1 + ctx.lineOffset } })
        buf = lines.slice(i); bufStart = i; i = lines.length; break
      }
      const inner = lines.slice(i, j + 1)
      inner[0] = inner[0].slice(2)
      inner[inner.length - 1] = inner[inner.length - 1].trimEnd().slice(0, -2)
      let title: string | null = null
      let first = inner[0]
      const startsContent = first.startsWith('[')
      if (!startsContent && first.trim()) {
        title = first.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
        first = ''
      }
      inner[0] = first
      const bodyText = inner.join('\n')
      const kids = parseMarkdown(bodyText, { ...ctx, lineOffset: ctx.lineOffset + i })
      out.push({ type: 'callout', id: '', range: [i + 1 + ctx.lineOffset, j + 1 + ctx.lineOffset], calloutKind: asideKind(title), title, children: kids })
      i = j
      bufStart = i + 1
      continue
    }
    if (buf.length === 0) bufStart = i
    buf.push(lines[i])
  }
  flush()
  return out
}

// ---- Plain text -------------------------------------------------------------------------------
export function inlineText(nodes: Inline[]): string {
  return nodes.map((n) => {
    switch (n.type) {
      case 'text': case 'code': case 'dice': return n.value
      case 'lineBreak': return ' '
      default: return inlineText(n.children)
    }
  }).join('')
}

export function blockText(bs: Block[]): string {
  const parts: string[] = []
  for (const b of bs) {
    switch (b.type) {
      case 'paragraph': case 'heading': parts.push(inlineText(b.children)); break
      case 'list': for (const li of b.children) parts.push(blockText(li.children)); break
      case 'table': parts.push(b.header.map(inlineText).join(' | ')); for (const r of b.rows) parts.push(r.map(inlineText).join(' | ')); break
      case 'blockquote': case 'callout': parts.push(blockText(b.children)); break
      case 'codeBlock': parts.push(b.value); break
      case 'image': parts.push(b.alt); break
    }
  }
  return parts.filter(Boolean).join('\n')
}

export const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length

// ---- Finalize: title, depth shift, heading ids, node ids ----------------------------------
export type Finalized = { title: string | null; titleDepth: number | null; body: Block[]; headings: Heading[] }

export const legacySlug = (text: string) => ghSlug(text)

/** Consumes the leading title heading (the first heading, if it is the first block) and normalises so the
 *  next level becomes H2. Body headings get unique ids; every node gets an id. */
export function finalize(raw: Block[], opts: { fallbackTitle?: string; isTitle: (depth: number, text: string) => boolean }): Finalized {
  let blocksIn = raw
  let title: string | null = null
  let titleDepth: number | null = null
  const first = blocksIn[0]
  if (first && first.type === 'heading') {
    const t = inlineText(first.children).trim()
    if (opts.isTitle(first.depth, t)) {
      title = t; titleDepth = first.depth
      blocksIn = blocksIn.slice(1)
    }
  }
  const shift = titleDepth ? titleDepth - 1 : 0
  const used = new Set<string>()
  const headings: Heading[] = []
  const stack: Heading[] = []
  let n = 0
  const nid = () => `n${++n}`
  const walk = (bs: Block[], top: boolean) => {
    for (const b of bs) {
      b.id = nid()
      if (b.type === 'heading') {
        if (top) {
          b.depth = Math.min(6, Math.max(2, b.depth - shift))
          const text = inlineText(b.children).trim()
          while (stack.length && stack[stack.length - 1].depth >= b.depth) stack.pop()
          const parent = stack[stack.length - 1] ?? null
          // ancestor-qualified id on repeats under another parent; numeric suffix only for identical siblings
          const base = ghSlug(text) || 'section'
          let id = base
          if (used.has(id) && parent) id = `${parent.id}--${base}`
          let k = 2
          const stem = id
          while (used.has(id)) id = `${stem}-${k++}`
          used.add(id)
          const h: Heading = { id, text, depth: b.depth, parentId: parent?.id ?? null }
          headings.push(h); stack.push(h)
          ;(b as { id: string }).id = id
        }
      } else if (b.type === 'blockquote' || b.type === 'callout') walk(b.children, false)
      else if (b.type === 'list') for (const li of b.children) { li.id = nid(); walk(li.children, false) }
    }
  }
  walk(blocksIn, true)
  return { title: title ?? opts.fallbackTitle ?? null, titleDepth, body: blocksIn, headings }
}
