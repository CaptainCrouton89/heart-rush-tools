// Validation over dist/ and the source tree. Exits non-zero on any failure; unresolved links are reported, not failed.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { GM_DIR, PLAYER_DIR, PLAYER_GROUPS, GM_GROUPS, GENERATED_PLAYER, RACES_DIR, TALENTS_DIR, WORLD_CATEGORIES } from './sources.ts'
import { REPO, listMd } from './util.ts'
import type { CatalogueFile, Manifest, PageFile, Block } from './types.ts'

const DIST = join(REPO, 'packages/content/dist')
const rd = <T,>(rel: string): T => JSON.parse(readFileSync(join(DIST, rel), 'utf8'))
const fails: string[] = []
const ok = (cond: boolean, msg: string) => { if (!cond) fails.push(msg) }

const manifest = rd<Manifest>('manifest.json')
const report = rd<any>('report.json')
const pages = manifest.pages.map((p) => rd<PageFile>(p.dataPath))
const byId = new Map(pages.map((p) => [p.id, p]))

// Counts against the filesystem (not hard-coded): every source file must have produced exactly one page.
const count = (dir: string, skip: (f: string) => boolean = () => false) => listMd(dir).filter((f) => !skip(f)).length
const expected = {
  player: count(PLAYER_DIR, (f) => GENERATED_PLAYER.includes(f.replace(/\.md$/, ''))),
  gm: count(GM_DIR),
  races: count(RACES_DIR, (f) => f.startsWith('_')),
  combat: count(`${TALENTS_DIR}/combat_talents`, (f) => f.startsWith('_')),
  noncombat: count(`${TALENTS_DIR}/noncombat_talents`, (f) => f.startsWith('_')),
  spells: count(`${TALENTS_DIR}/spells`, (f) => f.startsWith('_')),
}
const actual = {
  player: pages.filter((p) => p.scope === 'player' && p.kind === 'chapter').length,
  gm: pages.filter((p) => p.scope === 'gm' && p.kind === 'chapter').length,
  races: pages.filter((p) => p.kind === 'race').length,
  combat: pages.filter((p) => p.kind === 'talent' && (p.facets as any).collection === 'combat').length,
  noncombat: pages.filter((p) => p.kind === 'talent' && (p.facets as any).collection === 'noncombat').length,
  spells: pages.filter((p) => p.kind === 'spell').length,
}
for (const k of Object.keys(expected) as Array<keyof typeof expected>) ok(expected[k] === actual[k], `count ${k}: source files ${expected[k]} != pages ${actual[k]}`)
ok(PLAYER_GROUPS.length > 0 && GM_GROUPS.length > 0, 'empty navigation manifest')

// Alaria: every declared topic (one per legacy combined book) has a reachable landing page; Overview is the home.
// The declared list is the reference, not the all_sections_formatted directory: two of those generated books are gitignored.
const topicStems = WORLD_CATEGORIES.flatMap((c) => c.topics.map((t) => t.stem))
const worldTopicPaths = new Set(pages.filter((p) => p.scope === 'world:alaria' && p.kind === 'landing').map((p) => p.path))
const kebabStem = (s: string) => s.normalize('NFKD').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const missingBooks = topicStems.filter((s) => !worldTopicPaths.has(`/worlds/alaria/${kebabStem(s)}`))
ok(missingBooks.length === 0, `Alaria topics without a landing page: ${missingBooks.join(', ')}`)
ok(worldTopicPaths.has('/worlds/alaria'), 'Alaria home missing')
ok(topicStems.length === 32, `expected 32 Alaria topics, found ${topicStems.length}`)

// Uniqueness
const paths = manifest.pages.map((p) => p.path)
ok(new Set(paths).size === paths.length, 'duplicate page paths')
ok(new Set(manifest.pages.map((p) => p.id)).size === manifest.pages.length, 'duplicate page ids')
ok(Object.keys(manifest.routes).length === manifest.pages.length, 'routes map size differs from pages')
const slugs = new Map<string, string>()
for (const p of pages) { const k = `${p.scope}:${p.parentId}:${p.slug}`; ok(!slugs.has(k), `duplicate slug ${k}`); slugs.set(k, p.id) }

// Versions on every artifact
const v = manifest.contentVersion
for (const p of pages) if (p.contentVersion !== v || p.schemaVersion !== 1) { fails.push(`version mismatch on ${p.id}`); break }
for (const k of ['talents', 'spells', 'kin-culture']) { const c = rd<CatalogueFile>(`catalogues/${k}.json`); ok(c.contentVersion === v, `catalogue ${k} version`) }
for (const k of ['talents', 'races', 'conditions']) ok(rd<any>(`catalogues/play/${k}.json`).contentVersion === v, `play catalogue ${k} version`)

// Catalogue totals equal canonical records
const cat = (k: string) => rd<CatalogueFile>(`catalogues/${k}.json`)
ok(cat('talents').entries.length === actual.combat + actual.noncombat, 'talents catalogue size')
ok(cat('spells').entries.length === actual.spells, 'spells catalogue size')
ok(cat('kin-culture').entries.length === actual.races, 'kin catalogue size')

// Heading ids unique per page; every internal link, preview target, search/glossary target resolves
const bad: string[] = []
const walkInlines = (nodes: any[], cb: (n: any) => void) => { for (const n of nodes) { cb(n); if (n.children) walkInlines(n.children, cb) } }
const walk = (bs: Block[], cb: (n: any) => void) => {
  for (const b of bs as any[]) {
    if (b.type === 'paragraph' || b.type === 'heading') walkInlines(b.children, cb)
    else if (b.type === 'list') for (const li of b.children) walk(li.children, cb)
    else if (b.type === 'table') for (const c of [b.header, ...b.rows.flat()]) walkInlines(c, cb)
    else if (b.type === 'blockquote' || b.type === 'callout') walk(b.children, cb)
  }
}
let linkCount = 0, sheetLeaks = 0, rawBr = 0
for (const p of pages) {
  const ids = new Set(p.headings.map((h) => h.id))
  ok(ids.size === p.headings.length, `duplicate heading ids in ${p.id}`)
  walk(p.body, (n) => {
    if (n.type === 'link' && !n.external) {
      linkCount++
      const t = n.target
      if (!t) { bad.push(`${p.id}: link without target ${n.url}`); return }
      const dest = byId.get(t.id)
      if (!dest || dest.path !== t.path || (t.anchor && !dest.headings.some((h) => h.id === t.anchor))) bad.push(`${p.id}: broken link ${n.url}`)
      if (!existsSync(join(DIST, 'previews', `${t.previewId}.json`))) bad.push(`${p.id}: no preview ${t.previewId}`)
    }
    if (n.type === 'link' && n.url.includes('docs.google.com/spreadsheets') ) sheetLeaks++
    if (n.type === 'text' && /<br\s*\/?>/i.test(n.value)) rawBr++
  })
  for (const r of p.crossRefs) if (!existsSync(join(DIST, 'previews', `${r.previewId}.json`))) bad.push(`${p.id}: crossRef preview ${r.previewId}`)
  if (p.previous && !byId.has(p.previous)) bad.push(`${p.id}: previous`)
  if (p.next && !byId.has(p.next)) bad.push(`${p.id}: next`)
  for (const c of p.children) if (!byId.has(c)) bad.push(`${p.id}: child ${c}`)
}
ok(bad.length === 0, `${bad.length} broken internal references:\n  ${bad.slice(0, 15).join('\n  ')}`)
ok(rawBr === 0, 'literal <br> left in text nodes')
ok(manifest.characterSheetUrl.length > 0 && sheetLeaks <= 3 * 1, 'character sheet link handling')
for (const [src, ids] of Object.entries(manifest.sources)) ok(ids.length >= 1, `source ${src} has no page`)
const glossary = rd<any>('glossary.json')
for (const [term, targets] of Object.entries<any>(glossary.terms)) for (const t of targets) { const d = byId.get(t.id.split('~')[0]); if (!d || (t.anchor && !d.headings.some((h) => h.id === t.anchor))) fails.push(`glossary ${term} -> ${t.id}`) }
ok(existsSync(join(DIST, 'search/pagefind-entry.json')), 'pagefind index missing')
// Race images: every file referenced exists in the app's public dir
const pub = join(REPO, 'apps/rules/public/races')
for (const p of pages) walk(p.body, () => {})
for (const p of pages) for (const b of p.body as any[]) if (b.type === 'image' && !existsSync(join(pub, decodeURIComponent(b.src.replace('/races/', ''))))) fails.push(`missing race image ${b.src}`)
// Unexpected hand-authored markdown in the manifest-excluded places
ok(!manifest.pages.some((p) => /claude/i.test(p.id)), 'instruction file indexed')

const sizes = { pages: 0, search: 0 }
void sizes
const unresolved: string[] = report.links.unresolvedList
console.log(`counts  player ${actual.player}  gm ${actual.gm}  races ${actual.races}  combat ${actual.combat}  noncombat ${actual.noncombat}  spells ${actual.spells}  alaria articles ${report.inventory.alariaArticles}  landings ${report.inventory.alariaLandings}  (topics ${topicStems.length})`)
console.log(`links   explicit ${report.links.explicit}  term ${report.termLinks}  character sheet ${report.links.sheet}  unresolved ${unresolved.length}  (rendered internal links checked: ${linkCount})`)
for (const u of unresolved) console.log(`  unresolved: ${u}`)
const diagByCode: Record<string, number> = {}
for (const d of report.diagnostics) diagByCode[d.code] = (diagByCode[d.code] ?? 0) + 1
console.log(`diagnostics ${JSON.stringify(diagByCode)}`)
if (fails.length) { console.error(`\nFAILED ${fails.length} check(s):\n- ${fails.join('\n- ')}`); process.exit(1) }
console.log('check ok')
void readdirSync
