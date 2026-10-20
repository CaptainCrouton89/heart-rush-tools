// The book's navigation tree, used by the desktop sidebar and the phone Menu sheet.
// Group rows are a landing link plus a separate chevron button that shows or hides the group's pages,
// so the chevron never steals the link. Groups holding the current page start expanded.
import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { NavNode } from '@heartrush/content/types'
import { cn } from '@heartrush/ui/lib/utils'
import { ChevronDownIcon } from './icons'
import type { LocalNav } from './site-shell'

type TreeContext = {
  rootPath: string
  activePath: string
  localNav: LocalNav | null
  /** Phone sheet rows are 44px tall; desktop rows are 32px. */
  touch: boolean
}

/** A page path below a leaf's path (a catalogue entry under its catalogue, an Alaria article under its topic). */
function isUnder(path: string, activePath: string) {
  return activePath.startsWith(path.endsWith('/') ? path : `${path}/`)
}

/** True when `node` is the current page or holds it. The book root's own path (Alaria overview) never counts as holding. */
function holdsActive(node: NavNode, ctx: TreeContext): boolean {
  if (node.external) return false
  if (node.path === ctx.activePath) return true
  if (node.children.length > 0) return node.children.some((c) => holdsActive(c, ctx))
  return node.path !== ctx.rootPath && isUnder(node.path, ctx.activePath)
}

export function NavTree({
  nav,
  activePath,
  localNav,
  touch,
  label,
}: {
  nav: NavNode
  activePath: string
  localNav: LocalNav | null
  touch: boolean
  label: string
}) {
  const ctx: TreeContext = { rootPath: nav.path, activePath, localNav, touch }
  // A chevron the reader pressed overrides the default; reaching a page inside a group re-expands that group.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [seenPath, setSeenPath] = useState(activePath)
  if (seenPath !== activePath) {
    setSeenPath(activePath)
    setOverrides((prev) => {
      const next = { ...prev }
      const clear = (n: NavNode) => {
        if (n.children.length > 0 && holdsActive(n, ctx)) delete next[n.id]
        n.children.forEach(clear)
      }
      clear(nav)
      return next
    })
  }
  const isExpanded = (n: NavNode) => overrides[n.id] ?? holdsActive(n, ctx)
  const toggle = (n: NavNode) => setOverrides((prev) => ({ ...prev, [n.id]: !isExpanded(n) }))
  const rootCurrent = nav.path === activePath
  const rootClass = cn('eyebrow flex items-center rounded-sm', touch ? 'min-h-11 px-3.5' : 'mb-2 px-3.5 py-1')

  return (
    <nav aria-label={label} className="font-sans">
      {/* Alaria's first child (Alaria overview) is the book home itself; the heading then stays plain text so the
          same destination is not listed, and announced as current, twice. */}
      {nav.children.some((c) => c.path === nav.path) ? (
        <p className={rootClass}>{nav.label}</p>
      ) : (
        <Link
          to={nav.path}
          aria-current={rootCurrent ? 'page' : undefined}
          className={cn(rootClass, 'hover:text-foreground', rootCurrent && 'text-foreground')}
        >
          {nav.label}
        </Link>
      )}
      <NodeList nodes={nav.children} ctx={ctx} depth={0} isExpanded={isExpanded} toggle={toggle} />
    </nav>
  )
}

function NodeList({
  nodes,
  ctx,
  depth,
  isExpanded,
  toggle,
  id,
  hidden,
}: {
  nodes: NavNode[]
  ctx: TreeContext
  depth: number
  isExpanded: (n: NavNode) => boolean
  toggle: (n: NavNode) => void
  id?: string
  hidden?: boolean
}) {
  return (
    <ul id={id} hidden={hidden} className={cn(depth > 0 && 'ml-3 border-l border-border')}>
      {nodes.map((node) =>
        node.children.length > 0 ? (
          <GroupItem key={node.id} node={node} ctx={ctx} depth={depth} isExpanded={isExpanded} toggle={toggle} />
        ) : (
          <LeafItem key={node.id} node={node} ctx={ctx} depth={depth} />
        ),
      )}
    </ul>
  )
}

/** Shared row look: a 2px primary line and medium weight mark the current page (and the leaf holding it). */
function rowClass(ctx: TreeContext, depth: number, marked: boolean) {
  return cn(
    'flex min-w-0 flex-1 items-center rounded-r-sm border-l-2 py-1.5 pr-2 pl-3 transition-colors hover:text-foreground',
    'text-ui',
    ctx.touch && 'min-h-11',
    depth > 0 && '-ml-px',
    marked ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground',
  )
}

function GroupItem({
  node,
  ctx,
  depth,
  isExpanded,
  toggle,
}: {
  node: NavNode
  ctx: TreeContext
  depth: number
  isExpanded: (n: NavNode) => boolean
  toggle: (n: NavNode) => void
}) {
  const listId = useId()
  const expanded = isExpanded(node)
  const current = node.path === ctx.activePath
  return (
    <li className={cn(depth === 0 && 'mt-1')}>
      <div className="flex items-center">
        <Link
          to={node.path}
          aria-current={current ? 'page' : undefined}
          className={cn(
            rowClass(ctx, depth, current),
            depth === 0 && 'font-medium text-foreground',
          )}
        >
          {node.label}
        </Link>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-label={`${node.label} pages`}
          onClick={() => toggle(node)}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground',
            ctx.touch ? 'size-11' : 'size-8',
          )}
        >
          <ChevronDownIcon className={cn('size-4 transition-transform', !expanded && '-rotate-90')} />
        </button>
      </div>
      <NodeList
        nodes={node.children}
        ctx={ctx}
        depth={depth + 1}
        isExpanded={isExpanded}
        toggle={toggle}
        id={listId}
        hidden={!expanded}
      />
    </li>
  )
}

function LeafItem({ node, ctx, depth }: { node: NavNode; ctx: TreeContext; depth: number }) {
  if (node.external) {
    return (
      <li>
        <a href={node.path} className={rowClass(ctx, depth, false)}>
          {node.label.replace(/\s*↗$/, '')}
          <span aria-hidden="true">&nbsp;↗</span>
          <span className="sr-only"> (external site)</span>
        </a>
      </li>
    )
  }
  const current = node.path === ctx.activePath
  const holds = !current && holdsActive(node, ctx)
  const local = holds && ctx.localNav
  return (
    <li>
      <Link
        to={node.path}
        aria-current={current ? 'page' : holds ? 'true' : undefined}
        className={rowClass(ctx, depth, current || holds)}
      >
        {node.label}
      </Link>
      {local && <LocalNavList localNav={local} ctx={ctx} depth={depth + 1} />}
    </li>
  )
}

/** Below sidebar depth (an Alaria article inside a topic): "Up to <parent>" and the article's immediate siblings. */
function LocalNavList({ localNav, ctx, depth }: { localNav: LocalNav; ctx: TreeContext; depth: number }) {
  return (
    <ul className="ml-3 border-l border-border">
      <li>
        <Link to={localNav.up.path} className={rowClass(ctx, depth, false)}>
          Up to {localNav.up.title}
        </Link>
      </li>
      {localNav.siblings.map((s) => {
        const current = s.path === ctx.activePath
        return (
          <li key={s.path}>
            <Link to={s.path} aria-current={current ? 'page' : undefined} className={rowClass(ctx, depth, current)}>
              {s.title}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
