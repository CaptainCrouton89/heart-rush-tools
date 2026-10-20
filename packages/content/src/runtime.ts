// Runtime read helpers. No filesystem: the manifest is imported into the Worker bundle, everything else is
// fetched from `/_content/<contentVersion>/…` through an assets-style fetcher (env.ASSETS.fetch on the server,
// window.fetch in the browser).
import { agentSourceRel, type AgentIndex } from './agent'
import type { CatalogueFile, CatalogueKind, GlossaryFile, Manifest, NavNode, PageFile, PreviewFile } from './types.ts'

export type Fetcher = (input: string) => Promise<Response>
export type Audience = 'player' | 'gm' | 'world'

export function contentUrl(manifest: Manifest, rel: string): string {
  return `/_content/${manifest.contentVersion}/${rel}`
}

async function getJson<T>(fetcher: Fetcher, manifest: Manifest, rel: string): Promise<T | null> {
  const res = await fetcher(contentUrl(manifest, rel))
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`content fetch ${rel} failed: ${res.status}`)
  const data = (await res.json()) as T & { contentVersion?: string }
  if (data.contentVersion && data.contentVersion !== manifest.contentVersion) {
    throw new Error(`content version mismatch on ${rel}: ${data.contentVersion} != ${manifest.contentVersion}`)
  }
  return data
}

export * from './agent'

/** The agent search index, or null when the build did not publish one. */
export const loadAgentIndex = (manifest: Manifest, fetcher: Fetcher) => getJson<AgentIndex>(fetcher, manifest, 'agent/index.json')
/** One source part of a served page (line numbers match the file on disk), or null when absent. */
export async function loadAgentSource(manifest: Manifest, fetcher: Fetcher, pageId: string, part: number): Promise<string | null> {
  const rel = agentSourceRel(pageId, part)
  const res = await fetcher(contentUrl(manifest, rel))
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`content fetch ${rel} failed: ${res.status}`)
  return res.text()
}

/** Pathname → page, or null when the route does not exist (the loader turns that into a 404). */
export async function loadPageByPath(manifest: Manifest, fetcher: Fetcher, pathname: string): Promise<PageFile | null> {
  const id = manifest.routes[pathname.replace(/\/+$/, '') || '/']
  return id ? loadPage(manifest, fetcher, id) : null
}
export const loadPage = (manifest: Manifest, fetcher: Fetcher, id: string) => getJson<PageFile>(fetcher, manifest, `pages/${id}.json`)
export const loadCatalogue = (manifest: Manifest, fetcher: Fetcher, kind: CatalogueKind) => getJson<CatalogueFile>(fetcher, manifest, `catalogues/${kind}.json`)
export const loadPreview = (manifest: Manifest, fetcher: Fetcher, targetId: string) => getJson<PreviewFile>(fetcher, manifest, `previews/${targetId}.json`)
export const loadGlossary = (manifest: Manifest, fetcher: Fetcher) => getJson<GlossaryFile>(fetcher, manifest, 'glossary.json')

/** The navigation subtree for a book, from the manifest alone. */
export function navigationFor(manifest: Manifest, audience: Audience): NavNode | undefined {
  return manifest.navigation.find((n) => n.id === (audience === 'world' ? 'worlds' : audience))
}

export function listPages(manifest: Manifest, audience: Audience, kind?: string) {
  const scope = audience === 'world' ? 'world:alaria' : audience
  return manifest.pages.filter((p) => p.scope === scope && (!kind || p.kind === kind))
}

/** Typed accessors bound to one manifest and fetcher. `getEntry`/`getCatalogue` use catalogue kinds. */
export function createContent(manifest: Manifest, fetcher: Fetcher) {
  // The parsed agent index is 1.4 MB: keep it for the life of the isolate. A failed load is not kept, so the next request retries.
  let agentIndex: Promise<AgentIndex | null> | null = null
  const entryPath = (kind: CatalogueKind, slug: string) => `/player/${kind}/${slug}`
  return {
    manifest,
    navigation: manifest.navigation,
    getChapter: async (audience: 'player' | 'gm', slug: string) => {
      const page = await loadPageByPath(manifest, fetcher, `/${audience}/${slug}`)
      return page && page.kind === 'chapter' ? page : null
    },
    listChapters: (audience: 'player' | 'gm') => listPages(manifest, audience, 'chapter'),
    getCatalogue: (kind: CatalogueKind) => loadCatalogue(manifest, fetcher, kind),
    getEntry: (kind: CatalogueKind, slug: string) => loadPageByPath(manifest, fetcher, entryPath(kind, slug)),
    getPageByPath: (pathname: string) => loadPageByPath(manifest, fetcher, pathname),
    getPage: (id: string) => loadPage(manifest, fetcher, id),
    getPreview: (targetId: string) => loadPreview(manifest, fetcher, targetId),
    getGlossary: () => loadGlossary(manifest, fetcher),
    getAgentIndex: () => {
      const p = (agentIndex ??= loadAgentIndex(manifest, fetcher))
      p.then((v) => { if (!v) agentIndex = null }, () => { agentIndex = null })
      return p
    },
    getAgentSource: (pageId: string, part: number) => loadAgentSource(manifest, fetcher, pageId, part),
    /** Search is the Pagefind bundle at this URL, loaded in the browser on demand. */
    searchBundleUrl: contentUrl(manifest, 'search/'),
  }
}
export type Content = ReturnType<typeof createContent>
