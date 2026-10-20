// Server functions over the compiled rulebook. Route loaders call these (never `~/lib/content` directly):
// `content` imports `cloudflare:workers`, which only exists in the Worker, while loaders also run in the browser.
import { createServerFn } from '@tanstack/react-start'
import type { CatalogueKind, ChildSummary, NavNode } from '@heartrush/content/types'
import type { LocalNav } from '~/components/shell/site-shell'
import { content } from '~/lib/content'
import { AT_THE_TABLE, BOOK_HOMES, LEARN_THE_GAME, RUN_THE_GAME } from '~/components/landing/home-links'

/** One page (chapter, landing, catalogue entry, world article) by canonical pathname, or null → the route throws notFound(). */
export const getPageByPathFn = createServerFn({ method: 'GET' })
  .validator((pathname: string) => pathname)
  .handler(({ data }) => content.getPageByPath(data))

export const getPageFn = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(({ data }) => content.getPage(data))

export const getCatalogueFn = createServerFn({ method: 'GET' })
  .validator((kind: CatalogueKind) => kind)
  .handler(({ data }) => content.getCatalogue(data))

// ---- Landings ----------------------------------------------------------------------------------------------------
type Book = 'player' | 'gm' | 'alaria'

/** The sidebar subtree for a book; route loaders pass it to SiteShell's `nav`. */
function bookNav(book: Book): NavNode {
  const nav = book === 'alaria'
    ? content.navigation.find((n) => n.id === 'worlds')?.children.find((n) => n.id === 'worlds.alaria')
    : content.navigation.find((n) => n.id === book)
  if (!nav) throw new Error(`manifest.navigation has no ${book} book`)
  return nav
}

/** Navigation labels by page id ("Introduction" for the source title "A Brief Intro"); rows use them when the child is in the sidebar. */
// Built on first use inside a handler: a module-level read of `content` would keep `~/lib/content` (and
// `cloudflare:workers`) in the client bundle of this file.
let labels: Map<string, string> | undefined
const navLabels = {
  get(id: string) {
    if (!labels) {
      const map = new Map<string, string>()
      ;(function walk(nodes: NavNode[]) {
        for (const n of nodes) {
          if (!n.external && !map.has(n.id)) map.set(n.id, n.label)
          walk(n.children)
        }
      })(content.navigation)
      labels = map
    }
    return labels.get(id)
  },
}
const rowsOf = (page: { childSummaries: ChildSummary[] }) => page.childSummaries.map((c) => ({ ...c, title: navLabels.get(c.id) ?? c.title }))

async function pageById(id: string) {
  const page = await content.getPage(id)
  if (!page) throw new Error(`${id} is referenced by the manifest but has no page`)
  return page
}

function alaria() {
  const world = content.manifest.worlds.find((w) => w.id === 'alaria')
  if (!world) throw new Error('manifest.worlds has no alaria')
  return world
}

/** Landing pages with their child rows, for a home that lists every category and the pages under it. */
async function landingGroups(ids: string[]) {
  return Promise.all(ids.map(async (id) => {
    const page = await pageById(id)
    return { id, title: navLabels.get(id) ?? page.title, path: page.path, rows: rowsOf(page) }
  }))
}

/** Home: the two-sentence source introduction (opening paragraph of the Introduction chapter) and Alaria's row. */
export const getHomeFn = createServerFn({ method: 'GET' }).handler(async () => {
  const intro = await pageById('player.introduction')
  const first = intro.body.find((b) => b.type === 'paragraph')
  if (!first || first.type !== 'paragraph') throw new Error('player.introduction has no opening paragraph')
  const text = first.children.map(function flat(i): string {
    return 'value' in i && typeof i.value === 'string' ? i.value : 'children' in i ? i.children.map(flat).join('') : ' '
  }).join('')
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text]
  const dead = [LEARN_THE_GAME, AT_THE_TABLE, RUN_THE_GAME].flatMap((c) => c.links).filter((l) => !BOOK_HOMES.includes(l.path) && !content.manifest.routes[l.path])
  if (dead.length) throw new Error(`home links to unpublished paths: ${dead.map((l) => l.path).join(', ')}`)
  return { intro: sentences.slice(0, 2).join('').trim(), mapUrl: alaria().mapUrl }
})

/** /player or /gm: the sidebar tree plus every category landing with its rows. */
export const getBookHomeFn = createServerFn({ method: 'GET' })
  .validator((book: 'player' | 'gm') => book)
  .handler(async ({ data }) => {
    const nav = bookNav(data)
    return { nav, groups: await landingGroups(nav.children.map((c) => c.id)) }
  })

/** /worlds: every world with its home page's description. */
export const getWorldsFn = createServerFn({ method: 'GET' }).handler(() =>
  Promise.all(content.manifest.worlds.map(async (w) => ({ ...w, description: (await pageById(`worlds.${w.id}`)).description }))))

/**
 * A compiled page inside a book (a player/GM group landing, or anything under /worlds/alaria) with that book's
 * sidebar tree. World pages below sidebar depth (deeper than /worlds/alaria/<topic>) also get `localNav`:
 * "Up to <parent>" and the parent's children. The Alaria home also gets its category landings' rows.
 * Null when the path is not published in that book.
 */
export const getBookPageFn = createServerFn({ method: 'GET' })
  .validator((pathname: string) => pathname)
  .handler(async ({ data }) => {
    const book: Book | null = data.startsWith('/player/') ? 'player' : data.startsWith('/gm/') ? 'gm' : data === '/worlds/alaria' || data.startsWith('/worlds/alaria/') ? 'alaria' : null
    const page = book && (await content.getPageByPath(data))
    if (!book || !page || page.scope !== (book === 'alaria' ? 'world:alaria' : book)) return null
    const base = { page: { ...page, childSummaries: rowsOf(page) }, nav: bookNav(book), localNav: null as LocalNav | null, groups: null as LandingGroup[] | null, mapUrl: alaria().mapUrl, sequence: null as Sequence | null }
    if (page.id === 'worlds.alaria') return { ...base, groups: await landingGroups(page.children) }
    const depth = page.path.split('/').length - 1
    if (book !== 'alaria' || depth <= 3 || page.path.startsWith('/worlds/alaria/topics/') || !page.parentId) return base
    const parent = await pageById(page.parentId)
    const link = (id: string | null) => {
      const c = id ? parent.childSummaries.find((s) => s.id === id) : undefined
      return c ? { title: c.title, path: c.path } : null
    }
    return {
      ...base,
      localNav: { up: { title: parent.title, path: parent.path }, siblings: parent.childSummaries.map((c) => ({ title: c.title, path: c.path })) },
      // Set only when the compiler declares an ordered source sequence for this article.
      sequence: { previous: link(page.previous), next: link(page.next) },
    }
  })
type Sequence = { previous: { title: string; path: string } | null; next: { title: string; path: string } | null }
export type LandingGroup = { id: string; title: string; path: string; rows: ChildSummary[] }

export type ReadingLink = { id: string; title: string; path: string }

/**
 * A player/GM book's sidebar tree plus the navigation label and path of each given page id — the chapter route
 * resolves `page.previous` / `page.next` with it. Throws on an id the navigation does not list: previous/next are
 * compiled from that same navigation, so a miss is a compiler bug, not a page to hide.
 */
export const getReadingContextFn = createServerFn({ method: 'GET' })
  .validator((input: { book: 'player' | 'gm'; ids: string[] }) => input)
  .handler(({ data }) => {
    const links: ReadingLink[] = data.ids.map((id) => {
      const title = navLabels.get(id)
      const path = content.manifest.pages.find((p) => p.id === id)?.path
      if (!title || !path) throw new Error(`page ${id} is not in the navigation`)
      return { id, title, path }
    })
    return { nav: bookNav(data.book), links }
  })

// ---- Catalogues unit --------------------------------------------------------------------------------------------
/** A catalogue list page: its authored introduction page, the compact records and the player sidebar. */
export const getCatalogueViewFn = createServerFn({ method: 'GET' })
  .validator((kind: CatalogueKind) => kind)
  .handler(async ({ data }) => {
    const [page, catalogue] = await Promise.all([content.getPageByPath(`/player/${data}`), content.getCatalogue(data)])
    if (!page || page.kind !== 'catalogue') throw new Error(`/player/${data} is not a catalogue page`)
    if (!catalogue) throw new Error(`catalogues/${data}.json is missing`)
    return { page, catalogue, nav: bookNav('player') }
  })

/** A catalogue entry by pathname with the player sidebar, or null when no page of that kind is published there. */
export const getCatalogueEntryFn = createServerFn({ method: 'GET' })
  .validator((input: { path: string; kind: 'talent' | 'spell' | 'race' }) => input)
  .handler(async ({ data }) => {
    const page = await content.getPageByPath(data.path)
    if (!page || page.kind !== data.kind) return null
    return { page, nav: bookNav('player') }
  })
