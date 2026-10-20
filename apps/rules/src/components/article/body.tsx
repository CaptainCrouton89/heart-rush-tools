// Renders a compiled body tree (packages/content "Data model": body tree) with the .prose-rules reading classes.
// It renders what the compiler resolved and nothing more: headings keep their compiled ids, internal links with a
// `target` (explicit or term-origin) go through ReferenceLink, and no text is scanned for references.
import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import type { Block, Inline, ListItem } from '@heartrush/content/types'
import { ReferenceLink } from '~/components/preview/reference-link'
import { PreviewProvider } from '~/components/preview/preview-context'
import { canonicalUrl, copyText } from './canonical'
import { LinkIcon } from './icons'
import { useHashFocus } from '~/lib/outline'

/** Announces heading-link copies in one polite live region per body. */
const AnnounceContext = createContext<(message: string) => void>(() => {})

export function ArticleBody({ blocks, contentVersion }: { blocks: Block[]; contentVersion: string }) {
  const [announcement, setAnnouncement] = useState('')
  useHashFocus()
  useEffect(() => {
    if (!announcement) return
    const timer = setTimeout(() => setAnnouncement(''), 3000)
    return () => clearTimeout(timer)
  }, [announcement])

  return (
    <PreviewProvider contentVersion={contentVersion}>
      <AnnounceContext.Provider value={setAnnouncement}>
        <div className="prose-rules">
          <Blocks blocks={blocks} />
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </AnnounceContext.Provider>
    </PreviewProvider>
  )
}

/** A block sequence. A table without a caption is labelled by the heading that precedes it in the same sequence. */
function Blocks({ blocks, precedingHeading = null }: { blocks: Block[]; precedingHeading?: string | null }) {
  let lastHeading: string | null = precedingHeading
  return blocks.map((block) => {
    if (block.type === 'heading') lastHeading = block.id
    return <BlockNode key={block.id} block={block} labelledBy={lastHeading} />
  })
}

function BlockNode({ block, labelledBy }: { block: Block; labelledBy: string | null }) {
  switch (block.type) {
    case 'paragraph':
      return <p id={block.id}><Inlines nodes={block.children} /></p>
    case 'heading':
      return <HeadingBlock id={block.id} depth={block.depth}>{block.children}</HeadingBlock>
    case 'list':
      return block.ordered ? (
        <ol id={block.id} start={block.start ?? undefined}>
          <ListItems items={block.children} precedingHeading={labelledBy} />
        </ol>
      ) : (
        <ul id={block.id}>
          <ListItems items={block.children} precedingHeading={labelledBy} />
        </ul>
      )
    case 'table':
      return <TableBlock block={block} labelledBy={labelledBy} />
    case 'blockquote':
      return (
        <blockquote id={block.id}>
          <Blocks blocks={block.children} precedingHeading={labelledBy} />
        </blockquote>
      )
    case 'callout': {
      const kind = CALLOUT_LABELS[block.calloutKind]
      const label = !block.title || block.title.toLowerCase().includes(kind.toLowerCase()) ? (block.title ?? kind) : `${kind}: ${block.title}`
      return (
        <aside id={block.id} className="callout" data-kind={block.calloutKind} aria-labelledby={`${block.id}-label`}>
          <p id={`${block.id}-label`} className="callout-label">{label}</p>
          <Blocks blocks={block.children} precedingHeading={labelledBy} />
        </aside>
      )
    }
    case 'image':
      return (
        <img
          id={block.id}
          src={encodeURI(block.src)}
          alt={block.alt}
          width={block.width ?? undefined}
          height={block.height ?? undefined}
          loading="lazy"
          decoding="async"
        />
      )
    case 'codeBlock':
      return (
        <pre id={block.id}>
          <code data-lang={block.lang ?? undefined}>{block.value}</code>
        </pre>
      )
    case 'thematicBreak':
      return <hr id={block.id} />
  }
}

const CALLOUT_LABELS = { example: 'Example', note: 'Note', warning: 'Warning' } as const

function ListItems({ items, precedingHeading }: { items: ListItem[]; precedingHeading: string | null }) {
  return items.map((item) => (
    <li key={item.id} id={item.id}>
      {item.checked !== null && (
        <input type="checkbox" checked={item.checked} disabled aria-label={item.checked ? 'Done' : 'Not done'} className="mr-2" />
      )}
      <Blocks blocks={item.children} precedingHeading={precedingHeading} />
    </li>
  ))
}

// ---- Headings -----------------------------------------------------------------------------------------------------

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

/**
 * A heading with its compiled id and a .heading-anchor control. The control is a real `#id` link (it works without
 * JavaScript); with JavaScript it copies the canonical URL of the heading. If the clipboard refuses, it selects the
 * canonical URL in a read-only field for manual copying.
 */
function HeadingBlock({ id, depth, children }: { id: string; depth: number; children: Inline[] }) {
  const Tag = HEADING_TAGS[Math.min(Math.max(depth, 1), 6) - 1]!
  const text = plainText(children)
  const announce = useContext(AnnounceContext)
  const [copied, setCopied] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => { if (manualUrl) field.current?.select() }, [manualUrl])
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function onClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    const url = canonicalUrl(window.location.pathname, id)
    if (await copyText(url)) {
      setCopied(true)
      announce(`Link to ${text} copied`)
    } else {
      setManualUrl(url)
      announce(`Copying is unavailable. Copy the selected link to ${text}`)
    }
  }

  return (
    <Tag id={id} className="max-xl:scroll-mt-28">
      <Inlines nodes={children} />
      <a href={`#${id}`} className="heading-anchor print-hidden inline-flex min-h-11 min-w-11 items-center justify-center" aria-label={`Copy link to ${text}`} onClick={onClick}>
        <LinkIcon className="inline size-[0.75em] align-baseline" />
        {copied && <span className="ml-1 font-sans text-meta font-normal" aria-hidden="true">Copied</span>}
      </a>
      {manualUrl && (
        <input ref={field} aria-label={`Link to ${text}`} readOnly value={manualUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="print-hidden block h-11 w-full rounded-md border border-input bg-surface px-3 font-sans text-base font-normal" />
      )}
    </Tag>
  )
}

// ---- Tables -------------------------------------------------------------------------------------------------------

type TableBlockNode = Extract<Block, { type: 'table' }>

/** Numbers, dice and ranges ("1d12", "+6", "10-50", "×2", "—"): cells that must not wrap. */
const NUMERIC = /^[\s\d+\-−–—×x/%.,:()dD]*$/

function isNumericCell(cell: Inline[]) {
  if (cell.length === 0) return null
  if (cell.every((n) => n.type === 'dice' || n.type === 'lineBreak' || (n.type === 'text' && NUMERIC.test(n.value)))) {
    return /\d/.test(plainText(cell)) ? true : null
  }
  return false
}

/** A column is numeric when every non-empty body cell is a number or dice expression. */
function numericColumns(block: TableBlockNode) {
  return block.header.map((_, col) => {
    const kinds = block.rows.map((row) => isNumericCell(row[col] ?? []))
    return kinds.some((k) => k === true) && !kinds.some((k) => k === false)
  })
}

/**
 * A rules table. It always sits in a `.table-scroll` wrapper so a wide table never widens the page; the wrapper only
 * becomes a labelled, focusable scroll region with the "Scroll table horizontally" cue when the table actually
 * overflows (measured, and re-measured on resize).
 */
function TableBlock({ block, labelledBy }: { block: TableBlockNode; labelledBy: string | null }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const numeric = numericColumns(block)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const measure = () => setOverflows(wrapper.scrollWidth > wrapper.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(wrapper)
    if (wrapper.firstElementChild) observer.observe(wrapper.firstElementChild)
    return () => observer.disconnect()
  }, [])

  const align = (col: number) => block.align[col] ?? undefined
  const region = overflows
    ? {
        role: 'region',
        tabIndex: 0,
        ...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': 'Table' }),
        'aria-describedby': `${block.id}-cue`,
      }
    : {}

  return (
    <>
      <div ref={wrapperRef} className="table-scroll" {...region}>
        <table id={block.id} aria-labelledby={labelledBy ?? undefined}>
          <thead>
            <tr>
              {block.header.map((cell, col) => (
                <th key={col} scope="col" style={{ textAlign: align(col) }} data-numeric={numeric[col] ? '' : undefined}>
                  <Inlines nodes={cell} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {block.header.map((_, col) => (
                  <td key={col} style={{ textAlign: align(col) }} data-numeric={numeric[col] ? '' : undefined}>
                    <Inlines nodes={row[col] ?? []} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {overflows && (
        <p id={`${block.id}-cue`} className="table-scroll-cue print-hidden">
          Scroll table horizontally
        </p>
      )}
    </>
  )
}

// ---- Inline -------------------------------------------------------------------------------------------------------

function Inlines({ nodes }: { nodes: Inline[] }) {
  return nodes.map((node, i) => <InlineNode key={i} node={node} />)
}

function InlineNode({ node }: { node: Inline }): ReactNode {
  switch (node.type) {
    case 'text':
      return node.value
    case 'emphasis':
      return <em><Inlines nodes={node.children} /></em>
    case 'strong':
      return <strong><Inlines nodes={node.children} /></strong>
    case 'delete':
      return <del><Inlines nodes={node.children} /></del>
    case 'code':
      return <code>{node.value}</code>
    case 'dice':
      return <span className="dice" aria-label={node.label}>{node.value}</span>
    case 'lineBreak':
      return <br />
    case 'link':
      if (node.target) {
        return <ReferenceLink target={node.target}><Inlines nodes={node.children} /></ReferenceLink>
      }
      return <a href={node.url}><Inlines nodes={node.children} /></a>
  }
}

export function plainText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      if (n.type === 'text' || n.type === 'code' || n.type === 'dice') return n.value
      if (n.type === 'lineBreak') return ' '
      return plainText(n.children)
    })
    .join('')
}
