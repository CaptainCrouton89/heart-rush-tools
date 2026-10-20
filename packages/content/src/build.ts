import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as pagefind from 'pagefind'
import { collect } from './collect.ts'
import { buildCatalogue, buildGlossary, buildPlayConditions, buildPlayRaces, buildPlayTalents, buildPreview, buildSearchRecords, filterKindOf } from './emit.ts'
import { applyTerms, buildTermTargets, resolveLinks, targetIdOf } from './link.ts'
import { CHARACTER_SHEET_URL, MAP_URL, RACE_IMAGES_DIR } from './sources.ts'
import { REPO, sha } from './util.ts'
import { SCHEMA_VERSION, type Diagnostic, type Manifest, type PageFile, type SearchRecord } from './types.ts'

const PKG = join(REPO, 'packages/content')
const DIST = join(PKG, 'dist')
const RULES_PUBLIC = join(REPO, 'apps/rules/public')

const t0 = Date.now()
const c = collect()
const diagnostics: Diagnostic[] = [...c.diagnostics]
const diag = (d: Diagnostic) => diagnostics.push(d)
const drafts = c.drafts

// ---- Links ---------------------------------------------------------------------------------------
const linkStats = resolveLinks(drafts, CHARACTER_SHEET_URL, diag)
const termTargets = buildTermTargets(drafts, diag)
const termLinks = applyTerms(drafts, termTargets)

// ---- Reading order (player and GM books: chapters and collection landings) ---------------------------
for (const scope of ['player', 'gm'] as const) {
  const seq = drafts.filter((d) => d.page.scope === scope && (d.page.kind === 'chapter' || d.page.kind === 'catalogue'))
  // chapters are in navigation order already (collect adds them group by group)
  seq.forEach((d, i) => { d.page.previous = seq[i - 1]?.page.id ?? null; d.page.next = seq[i + 1]?.page.id ?? null })
}

// ---- Rewrite race image links in bodies and lift the first one into page.image ---------------------------
function fixImages(bs: any[], used: Set<string>) {
  for (const b of bs) {
    if (b.type === 'image') {
      const m = /([^/]+\.png)$/i.exec(decodeURIComponent(b.src))
      if (m) { b.src = `/races/${m[1]}`; used.add(m[1]) }
    }
    if (b.children && Array.isArray(b.children) && b.type !== 'paragraph' && b.type !== 'heading') fixImages(b.children, used)
    if (b.type === 'list') for (const li of b.children) fixImages(li.children, used)
  }
}
const usedImages = new Set<string>()
for (const d of drafts) fixImages(d.page.body, usedImages)

// ---- Content version: digest of all page content --------------------------------------------------------
const pagesNoVersion = drafts.map((d) => d.page)
const contentVersion = sha(JSON.stringify(pagesNoVersion)).slice(0, 12)

// ---- Manifest ----------------------------------------------------------------------------------------------
const routes: Record<string, string> = {}
for (const d of drafts) {
  if (routes[d.page.path]) throw new Error(`Duplicate route ${d.page.path}`)
  routes[d.page.path] = d.page.id
}
const manifest: Manifest = {
  schemaVersion: SCHEMA_VERSION, contentVersion,
  pages: drafts.map((d) => ({ id: d.page.id, path: d.page.path, kind: d.page.kind, scope: d.page.scope, dataPath: `pages/${d.page.id}.json` })),
  routes, characterSheetUrl: CHARACTER_SHEET_URL,
  worlds: [{ id: 'alaria', title: 'Alaria', path: '/worlds/alaria', mapUrl: MAP_URL }],
  navigation: c.nav,
  sources: Object.fromEntries(drafts.flatMap((d) => d.files.map((f) => [f, [] as string[]])).map(([f]) => [f as string, drafts.filter((d) => d.files.includes(f as string)).map((d) => d.page.id)])),
}

// ---- Write ----------------------------------------------------------------------------------------------------
rmSync(DIST, { recursive: true, force: true })
const w = (rel: string, data: unknown) => {
  const p = join(DIST, rel)
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, JSON.stringify(data))
}
w('manifest.json', manifest)
const pageById = new Map(drafts.map((d) => [d.page.id, d.page]))
for (const d of drafts) {
  d.page.childSummaries = d.page.children.map((id) => {
    const c = pageById.get(id)
    if (!c) throw new Error(`${d.page.id} lists unknown child ${id}`)
    return { id: c.id, path: c.path, title: c.title, description: c.description, readingMinutes: c.readingMinutes, kind: c.kind }
  })
}
for (const d of drafts) w(`pages/${d.page.id}.json`, { schemaVersion: SCHEMA_VERSION, contentVersion, ...d.page } satisfies PageFile)

const catalogues = (['talents', 'spells', 'kin-culture'] as const).map((k) => buildCatalogue(k, drafts, contentVersion))
for (const cat of catalogues) w(`catalogues/${cat.kind}.json`, cat)
const playFile = <T,>(entries: T[]) => ({ schemaVersion: SCHEMA_VERSION, contentVersion, entries })
w('catalogues/play/talents.json', playFile(buildPlayTalents(drafts)))
w('catalogues/play/races.json', playFile(buildPlayRaces(drafts, (message) => diag({ level: 'warn', code: 'play-grant-unresolved', message }))))
w('catalogues/play/conditions.json', playFile(buildPlayConditions(drafts)))

// Previews: every page, plus every cross-reference target and every H2/H3 of player/GM rules.
const byId = new Map(drafts.map((d) => [d.page.id, d]))
const previewKeys = new Set<string>()
for (const d of drafts) {
  previewKeys.add(targetIdOf(d.page.id, null))
  for (const r of d.page.crossRefs) previewKeys.add(r.previewId)
  if (d.page.scope !== 'world:alaria' && (d.page.kind === 'chapter' || d.page.kind === 'catalogue')) for (const h of d.page.headings) if (h.depth <= 3) previewKeys.add(targetIdOf(d.page.id, h.id))
}
for (const key of previewKeys) {
  const [pid, anchor] = key.split('~')
  const d = byId.get(pid)!
  w(`previews/${key}.json`, buildPreview(d, anchor ?? null, contentVersion))
}

const glossary = buildGlossary(drafts)
w('glossary.json', { schemaVersion: SCHEMA_VERSION, contentVersion, terms: glossary })

// ---- Search ---------------------------------------------------------------------------------------------------------
const records: SearchRecord[] = drafts.flatMap(buildSearchRecords)
const { index } = await pagefind.createIndex({ forceLanguage: 'en' })
if (!index) throw new Error('pagefind createIndex failed')
for (const r of records) {
  const res = await index.addCustomRecord({
    url: r.path + (r.anchor ? `#${r.anchor}` : ''),
    content: `${r.title}\n${r.text}`,
    language: 'en',
    meta: { title: r.title, breadcrumbs: r.breadcrumbs.join(' › '), anchor: r.anchor ?? '', targetId: r.targetId, kind: r.kind },
    filters: { scope: [r.scope], filterKind: [r.filterKind] },
    sort: {},
  })
  if (res.errors.length) throw new Error(`pagefind: ${res.errors.join('; ')}`)
}
const wr = await index.writeFiles({ outputPath: join(DIST, 'search') })
if (wr.errors.length) throw new Error(`pagefind write: ${wr.errors.join('; ')}`)
// Pagefind's _loadGenericChunk logs a failed index/filter chunk fetch and carries on, so search() resolves with
// partial or empty results. Make it rethrow so the UI can report "Search unavailable". The code is in both the
// main-thread bundle and the web worker that actually runs searches. Fail the build if a Pagefind upgrade changes
// it, so the patch cannot silently stop applying.
const chunkCatch = 'console.error(`Failed to load the index chunk ${url}:\n${e?.toString()}`);'
for (const file of ['pagefind.js', 'pagefind-worker.js']) {
  const path = join(DIST, 'search', file)
  const src = readFileSync(path, 'utf8')
  if (src.split(chunkCatch).length !== 2) throw new Error(`${file}: expected exactly one _loadGenericChunk catch to patch; Pagefind changed, update the patch in build.ts`)
  writeFileSync(path, src.replace(chunkCatch, () => `${chunkCatch}throw e;`))
}
await pagefind.close()
writeFileSync(join(PKG, '.search-records-count'), String(records.length))

// ---- Diagnostics + stats ------------------------------------------------------------------------------------------------
const report = {
  contentVersion, builtMs: Date.now() - t0, inventory: c.inventory, unlisted: c.unlisted,
  pages: drafts.length, searchRecords: records.length, previews: previewKeys.size, glossaryTerms: Object.keys(glossary).length,
  links: linkStats, termLinks, termTargets: termTargets.length, usedRaceImages: usedImages.size,
  diagnostics,
}
writeFileSync(join(DIST, 'report.json'), JSON.stringify(report, null, 1))

// ---- Race images ---------------------------------------------------------------------------------------------------------------
mkdirSync(join(RULES_PUBLIC, 'races'), { recursive: true })
for (const f of readdirSync(join(REPO, RACE_IMAGES_DIR))) if (/\.png$/i.test(f)) cpSync(join(REPO, RACE_IMAGES_DIR, f), join(RULES_PUBLIC, 'races', f))

// ---- Static assets for the rules Worker: /_content/<contentVersion>/… ---------------------------------------------------
const assets = join(RULES_PUBLIC, '_content')
rmSync(assets, { recursive: true, force: true })
cpSync(DIST, join(assets, contentVersion), { recursive: true, filter: (src) => !src.endsWith('report.json') })

console.log(`content ${contentVersion}: ${drafts.length} pages, ${records.length} search records, ${previewKeys.size} previews, ${linkStats.unresolved} unresolved links, ${diagnostics.length} diagnostics (${Date.now() - t0}ms)`)
