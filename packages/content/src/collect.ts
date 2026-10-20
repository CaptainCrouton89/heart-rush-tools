// Turns the inclusion manifest + source files into draft pages (bodies parsed, links not yet resolved).
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, posix } from 'node:path'
import {
  ALARIA_DIR, ALARIA_HOME, ALIASES, GENERATED_PLAYER, GM_DIR, GM_GROUPS, PLAYER_DIR, PLAYER_GROUPS, RACES_DIR, RACE_IMAGES_DIR,
  TALENTS_DIR, WORLD_CATEGORIES, type Group, type Leaf,
} from './sources.ts'
import { REPO, firstSentence, kebab, listMd, readText, stem } from './util.ts'
import { blockText, finalize, legacySlug, parseMarkdown, wordCount, inlineText } from './md.ts'
import { META_REPAIRS, parseSize, parseTalentMeta } from './catalogue.ts'
import type { Block, Crumb, Diagnostic, Heading, NavNode, Page, PageKind, Scope, SourceRef } from './types.ts'

export type Draft = {
  page: Page
  files: string[]          // repo-relative source files, for relative-link resolution
  legacySlug: string       // slug the old app gave this page's title (resolves old #anchor links)
  race?: { stem: string }
  talent?: { stem: string; collection: 'combat' | 'noncombat' | 'spells'; text: string }
}

export type Collected = {
  drafts: Draft[]
  nav: NavNode[]
  diagnostics: Diagnostic[]
  unlisted: { player: string[]; gm: string[] }
  inventory: { playerChapters: number; gmChapters: number; races: number; combat: number; noncombat: number; spells: number; alariaArticles: number; alariaLandings: number }
  raceImages: Map<string, { file: string; width: number; height: number }>
}

const idOf = (path: string) => path.replace(/^\//, '').replace(/\//g, '.')

function pngSize(file: string): { width: number; height: number } {
  const b = readFileSync(join(REPO, file))
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
}

export function collect(): Collected {
  const diagnostics: Diagnostic[] = []
  const diag = (d: Diagnostic) => diagnostics.push(d)
  const drafts: Draft[] = []
  const byPath = new Map<string, Draft>()

  const add = (d: Draft) => {
    if (byPath.has(d.page.path)) throw new Error(`Duplicate page path ${d.page.path} (${d.files[0]} vs ${byPath.get(d.page.path)!.files[0]})`)
    byPath.set(d.page.path, d)
    drafts.push(d)
    return d
  }

  type Parts = Array<{ file: string; text: string }>
  type MakeOpts = {
    path: string; kind: PageKind; scope: Scope; audience: Page['audience']
    parts: Parts; navTitle: string; fallbackTitle: string
    parentId: string | null; categoryId: string | null; order: number
    breadcrumbs: Crumb[]
    keepTitleHeading?: boolean   // do not consume the first heading as the page title
    transform?: (text: string, file: string) => { text: string; meta: string | null; tags: string[] }
    titleOverride?: string
  }

  function make(o: MakeOpts): Draft {
    const parsed: Block[] = []
    const sourceParts: SourceRef[] = []
    let meta: string | null = null
    const tags: string[] = []
    for (const part of o.parts) {
      let text = part.text
      if (o.transform) { const t = o.transform(text, part.file); text = t.text; meta = t.meta ?? meta; tags.push(...t.tags) }
      const lines = text.split('\n').length
      parsed.push(...parseMarkdown(text, { file: part.file, lineOffset: 0, diag }))
      sourceParts.push({ path: part.file, startLine: 1, endLine: lines })
    }
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')
    const isEntry = o.kind === 'talent' || o.kind === 'spell' || o.kind === 'race' || o.kind === 'worldArticle' || o.scope === 'world:alaria'
    const fin = finalize(parsed, {
      fallbackTitle: o.fallbackTitle,
      isTitle: (depth, text) => !o.keepTitleHeading && (depth === 1 || (depth === 2 && (isEntry || norm(text) === norm(o.navTitle)))),
    })
    const text = blockText(fin.body)
    const words = wordCount(text)
    const title = o.titleOverride ?? fin.title ?? o.fallbackTitle
    const firstPara = fin.body.find((b) => b.type === 'paragraph')
    const slugParts = o.path.split('/')
    const page: Page = {
      id: idOf(o.path), slug: slugParts[slugParts.length - 1], path: o.path, title, navTitle: o.navTitle, description: firstPara && firstPara.type === 'paragraph' ? firstSentence(inlineText(firstPara.children)) : null,
      kind: o.kind, scope: o.scope, worldId: o.scope === 'world:alaria' ? 'alaria' : null, audience: o.audience,
      categoryId: o.categoryId, parentId: o.parentId, order: o.order, breadcrumbs: o.breadcrumbs,
      source: o.parts.length ? sourceParts[0] : null, sourceParts: sourceParts.length > 1 ? sourceParts : [],
      body: fin.body, headings: fin.headings, crossRefs: [], aliases: [...new Set([...(ALIASES[o.path] ?? []), ...(o.navTitle !== title && o.kind !== 'landing' ? [o.navTitle] : [])])], tags: [...new Set(tags)],
      wordCount: words, readingMinutes: words ? Math.ceil(words / 220) : 0,
      children: [], childSummaries: [], previous: null, next: null, image: null, facets: null, rawMetadata: meta,
    }
    return add({ page, files: o.parts.map((p) => p.file), legacySlug: legacySlug(title) })
  }

  // ---- Player and GM chapters ---------------------------------------------
  const nav: NavNode[] = []
  const unlisted = { player: [] as string[], gm: [] as string[] }
  const raceImages = new Map<string, { file: string; width: number; height: number }>()
  for (const f of readdirSync(join(REPO, RACE_IMAGES_DIR))) {
    if (/\.png$/i.test(f)) raceImages.set(f.replace(/\.png$/i, ''), { file: f, ...pngSize(`${RACE_IMAGES_DIR}/${f}`) })
  }

  function book(scope: 'player' | 'gm', root: string, label: string, dir: string, groups: Group[]) {
    const onDisk = listMd(dir).map(stem).filter((s) => !(scope === 'player' && GENERATED_PLAYER.includes(s)))
    const listed = new Set(groups.flatMap((g) => g.leaves.flatMap((l) => ('file' in l ? [l.file] : []))))
    const other = onDisk.filter((s) => !listed.has(s))
    const missing = [...listed].filter((s) => !onDisk.includes(s))
    if (missing.length) throw new Error(`${scope}: manifest lists files that do not exist: ${missing.join(', ')}`)
    if (other.length) {
      unlisted[scope] = other
      groups = [...groups, { label: 'Other', slug: 'other', leaves: other.map((s): Leaf => ({ label: s.replace(/_/g, ' '), file: s })) }]
      for (const s of other) diag({ level: 'warn', code: 'unlisted-chapter', message: `${dir}/${s}.md is not in the source manifest; placed under Other` })
    }
    const rootCrumb: Crumb = { title: label, path: root }
    const bookNav: NavNode = { id: scope, label, path: root, children: [] }
    nav.push(bookNav)
    groups.forEach((g, gi) => {
      const gpath = `${root}/topics/${g.slug}`
      const gcrumb: Crumb = { title: g.label, path: gpath }
      const landing = make({
        path: gpath, kind: 'landing', scope, audience: scope === 'gm' ? 'gm' : 'player', parts: [], navTitle: g.label, fallbackTitle: g.label,
        parentId: null, categoryId: g.slug, order: gi, breadcrumbs: [rootCrumb],
      })
      const gnav: NavNode = { id: landing.page.id, label: g.label, path: gpath, children: [] }
      bookNav.children.push(gnav)
      g.leaves.forEach((leaf, li) => {
        const slug = kebab(leaf.label)
        const path = `${root}/${slug}`
        if ('file' in leaf) {
          const rel = `${dir}/${leaf.file}.md`
          const d = make({
            path, kind: 'chapter', scope, audience: scope === 'gm' ? 'gm' : 'player', parts: [{ file: rel, text: readText(rel) }],
            navTitle: leaf.label, fallbackTitle: leaf.label, parentId: landing.page.id, categoryId: g.slug, order: li,
            breadcrumbs: [rootCrumb, gcrumb],
          })
          landing.page.children.push(d.page.id); gnav.children.push({ id: d.page.id, label: leaf.label, path, children: [] })
        } else {
          const d = catalogueLanding(leaf.catalogue, path, leaf.label, landing.page.id, g.slug, li, [rootCrumb, gcrumb])
          landing.page.children.push(d.page.id); gnav.children.push({ id: d.page.id, label: leaf.label, path, children: [] })
        }
      })
    })
  }

  // ---- Catalogues --------------------------------------------------------------------
  const TL = `${TALENTS_DIR}`
  function catalogueLanding(kind: 'talents' | 'spells' | 'kin-culture', path: string, label: string, parentId: string, categoryId: string, order: number, crumbs: Crumb[]): Draft {
    const parts: Parts = kind === 'talents'
      ? [`${TL}/_intro.md`, `${TL}/noncombat_talents/_intro.md`].map((f) => ({ file: f, text: readText(f) }))
      : kind === 'spells' ? [{ file: `${TL}/spells/_intro.md`, text: readText(`${TL}/spells/_intro.md`) }]
      : [{ file: `${RACES_DIR}/_intro.md`, text: readText(`${RACES_DIR}/_intro.md`) }]
    return make({ path, kind: 'catalogue', scope: 'player', audience: 'player', parts, navTitle: label, fallbackTitle: label, titleOverride: label, keepTitleHeading: kind === 'spells', parentId, categoryId, order, breadcrumbs: crumbs })
  }

  book('player', '/player', 'Player rules', PLAYER_DIR, PLAYER_GROUPS)
  book('gm', '/gm', 'GM guide', GM_DIR, GM_GROUPS)

  // Entries (races, talents, spells) hang under their catalogue landing.
  const talentTransform = (text: string, file: string) => {
    const lines = text.split('\n')
    let meta: string | null = null
    const repair = META_REPAIRS[file]
    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      if (/^_.*_\s*$/.test(lines[i])) {
        let raw = lines[i].trim()
        if (repair && raw === repair[0]) { diag({ level: 'info', code: 'metadata-repaired', message: `Repaired source typo "${raw}" → "${repair[1]}"`, source: { path: file, line: i + 1 } }); raw = repair[1] }
        meta = raw; lines[i] = ''; break
      }
    }
    for (let i = 0; i < lines.length; i++) if (/^\*\*Destiny Level:\*\*\s*$/.test(lines[i])) lines[i] = '### Destiny Level'
    return { text: lines.join('\n'), meta, tags: [] as string[] }
  }

  function entries(
    cat: { path: string; kind: 'talents' | 'spells' | 'kin-culture'; label: string },
    files: Array<{ dir: string; collection?: 'combat' | 'noncombat' | 'spells' }>,
    kind: 'talent' | 'spell' | 'race',
  ) {
    const parent = byPath.get(cat.path)!
    const crumbs = [...parent.page.breadcrumbs, { title: cat.label, path: cat.path }]
    let order = 0
    const seen: Array<{ file: string; d: Draft }> = []
    for (const { dir, collection } of files) {
      for (const f of listMd(dir).filter((x) => !x.startsWith('_'))) {
        const rel = `${dir}/${f}`
        const text = readText(rel)
        const title = (/^## (.+)$/m.exec(text)?.[1] ?? stem(f)).trim()
        let slug = kebab(title)
        if (byPath.has(`${cat.path}/${slug}`)) {
          const other = byPath.get(`${cat.path}/${slug}`)!
          diag({ level: 'warn', code: 'slug-collision', message: `Entry slug "${slug}" collides (${other.files[0]} vs ${rel}); disambiguated by source file`, source: { path: rel, line: 1 } })
          slug = `${slug}-${kebab(stem(f))}`
        }
        const d = make({
          path: `${cat.path}/${slug}`, kind, scope: 'player', audience: 'player', parts: [{ file: rel, text }], navTitle: title, fallbackTitle: title,
          parentId: parent.page.id, categoryId: kind === 'race' ? 'kin-culture' : kind === 'spell' ? 'spells' : 'talents', order: order++, breadcrumbs: crumbs,
          transform: kind === 'race' ? undefined : talentTransform,
        })
        if (kind === 'race') d.race = { stem: stem(f) }
        else d.talent = { stem: stem(f), collection: collection!, text }
        parent.page.children.push(d.page.id)
        seen.push({ file: rel, d })
      }
    }
    return seen
  }

  const combat = entries({ path: '/player/talents', kind: 'talents', label: 'Talents' }, [{ dir: `${TL}/combat_talents`, collection: 'combat' }], 'talent')
  const noncombat = entries({ path: '/player/talents', kind: 'talents', label: 'Talents' }, [{ dir: `${TL}/noncombat_talents`, collection: 'noncombat' }], 'talent')
  const spells = entries({ path: '/player/spells', kind: 'spells', label: 'Spells' }, [{ dir: `${TL}/spells`, collection: 'spells' }], 'spell')
  const races = entries({ path: '/player/kin-culture', kind: 'kin-culture', label: 'Kin & culture' }, [{ dir: RACES_DIR }], 'race')

  // Talent facets
  for (const { d } of [...combat, ...noncombat, ...spells]) {
    const t = d.talent!
    const pm = d.page.rawMetadata ? parseTalentMeta(d.page.rawMetadata) : null
    if (!pm) diag({ level: 'warn', code: 'no-metadata', message: `No metadata line found; facets are empty`, source: { path: d.files[0], line: 1 } })
    for (const u of pm?.unknown ?? []) diag({ level: 'warn', code: 'metadata-unknown', message: `Unrecognised metadata segment "${u}" kept in rawMetadata only`, source: { path: d.files[0], line: 3 } })
    d.page.facets = {
      collection: t.collection,
      abilityTypes: pm?.facets.abilityTypes ?? [], traditions: pm?.facets.traditions ?? [], elements: pm?.facets.elements ?? [],
      timing: pm?.facets.timing ?? [], ongoing: pm?.facets.ongoing ?? null,
      hasDestinyUpgrade: d.page.headings.some((h) => h.text === 'Destiny Level'),
    }
  }

  // Race facets, images
  for (const { d, file } of races) {
    const t = readText(file)
    const m = /^- \*\*Size:?\*\*:?\s*(.+)$/m.exec(t)
    d.page.facets = { size: m ? m[1].trim() : parseSize([]) }
    // The sources never reference images; an image whose file name equals the race title (or a subrace heading) is placed there.
    const mk = (name: string, img: { file: string; width: number; height: number }): Block =>
      ({ type: 'image', id: `img-${kebab(name)}`, range: [1, 1], src: `/races/${img.file}`, alt: `Illustration of ${name}`, width: img.width, height: img.height })
    const main = raceImages.get(d.page.title)
    if (main) {
      d.page.image = { src: `/races/${main.file}`, alt: `Illustration of ${d.page.title}`, width: main.width, height: main.height }
      d.page.body.unshift(mk(d.page.title, main))
    }
    for (const h of d.page.headings) {
      const img = h.text !== d.page.title ? raceImages.get(h.text) : undefined
      if (!img) continue
      const at = d.page.body.findIndex((b) => b.type === 'heading' && b.id === h.id)
      d.page.body.splice(at + 1, 0, mk(h.text, img))
    }
  }

  // ---- Alaria -----------------------------------------------------------------------------
  const W = ALARIA_DIR
  const wroot: Crumb = { title: 'Worlds', path: '/worlds' }
  const alariaCrumb: Crumb = { title: 'Alaria', path: '/worlds/alaria' }
  const home = make({
    path: '/worlds/alaria', kind: 'landing', scope: 'world:alaria', audience: 'all',
    parts: [{ file: `${W}/${ALARIA_HOME.dir}/_intro.md`, text: readText(`${W}/${ALARIA_HOME.dir}/_intro.md`) }],
    navTitle: ALARIA_HOME.label, fallbackTitle: 'Alaria', titleOverride: 'Alaria', keepTitleHeading: true,
    parentId: null, categoryId: null, order: 0, breadcrumbs: [wroot],
  })
  const alariaNav: NavNode = { id: home.page.id, label: 'Alaria', path: '/worlds/alaria', children: [
    { id: home.page.id, label: ALARIA_HOME.label, path: '/worlds/alaria', children: [] },
    { id: 'alaria.map', label: 'World map', path: 'https://world.alariawiki.online/', external: true, children: [] },
  ] }
  let alariaArticles = 0, alariaLandings = 0
  const owned = new Set<string>()
  WORLD_CATEGORIES.forEach((cat, ci) => {
    const cpath = `/worlds/alaria/topics/${cat.slug}`
    const cl = make({ path: cpath, kind: 'landing', scope: 'world:alaria', audience: 'all', parts: [], navTitle: cat.label, fallbackTitle: cat.label, parentId: home.page.id, categoryId: cat.slug, order: ci, breadcrumbs: [wroot, alariaCrumb] })
    alariaLandings++
    home.page.children.push(cl.page.id)
    const cnav: NavNode = { id: cl.page.id, label: cat.label, path: cpath, children: [] }
    alariaNav.children.push(cnav)
    cat.topics.forEach((topic, ti) => {
      const tpath = `/worlds/alaria/${kebab(topic.stem)}`
      const tcrumbs = [wroot, alariaCrumb, { title: cat.label, path: cpath }]
      const introFile = `${W}/${topic.dir}/_intro.md`
      const hasIntro = existsSync(join(REPO, introFile))
      const tp = make({
        path: tpath, kind: 'landing', scope: 'world:alaria', audience: 'all',
        parts: hasIntro ? [{ file: introFile, text: readText(introFile) }] : [], navTitle: topic.label, fallbackTitle: topic.label, titleOverride: topic.label,
        parentId: cl.page.id, categoryId: cat.slug, order: ti, breadcrumbs: tcrumbs,
        transform: (text) => ({ text: extractTags(text).text, meta: null, tags: extractTags(text).tags }),
      })
      alariaLandings++
      cl.page.children.push(tp.page.id)
      cnav.children.push({ id: tp.page.id, label: topic.label, path: tpath, children: [] })
      owned.add(topic.dir); (topic.extraDirs ?? []).forEach((e) => owned.add(e))
      const topicCrumbs = [...tcrumbs, { title: topic.label, path: tpath }]
      const dirs: Array<{ dir: string; sub: string | null }> = [{ dir: topic.dir, sub: null }, ...(topic.extraDirs ?? []).map((e) => ({ dir: e, sub: posix.basename(e) }))]
      let order = 0
      for (const { dir, sub } of dirs) {
        let parentDraft = tp
        let crumbs = topicCrumbs
        if (sub) {
          const lf = `${W}/${dir}/_intro.md`
          if (!existsSync(join(REPO, lf))) throw new Error(`Alaria: expected ${lf}`)
          const sp = `${tpath}/${kebab(sub)}`
          parentDraft = make({
            path: sp, kind: 'landing', scope: 'world:alaria', audience: 'all', parts: [{ file: lf, text: readText(lf) }], navTitle: sub, fallbackTitle: sub.replace(/_/g, ' '),
            parentId: tp.page.id, categoryId: cat.slug, order: order++, breadcrumbs: topicCrumbs,
            transform: (text) => ({ text: extractTags(text).text, meta: null, tags: extractTags(text).tags }),
          })
          alariaLandings++
          tp.page.children.push(parentDraft.page.id)
          crumbs = [...topicCrumbs, { title: parentDraft.page.title, path: sp }]
        }
        let ao = 0
        for (const f of listMd(`${W}/${dir}`).filter((x) => x !== '_intro.md' && !/^(CLAUDE|\.claude)/.test(x))) {
          const rel = `${W}/${dir}/${f}`
          const base = sub ? `${tpath}/${kebab(sub)}` : tpath
          let p = `${base}/${kebab(stem(f))}`
          if (byPath.has(p)) { diag({ level: 'warn', code: 'slug-collision', message: `Article slug ${p} collides with ${byPath.get(p)!.files[0]}; disambiguated`, source: { path: rel, line: 1 } }); p += `-${kebab(posix.basename(dir))}` }
          const d = make({
            path: p, kind: 'worldArticle', scope: 'world:alaria', audience: 'all', parts: [{ file: rel, text: readText(rel) }], navTitle: stem(f), fallbackTitle: stem(f),
            parentId: parentDraft.page.id, categoryId: cat.slug, order: ao++, breadcrumbs: crumbs,
            transform: (text) => ({ text: extractTags(text).text, meta: null, tags: extractTags(text).tags }),
          })
          parentDraft.page.children.push(d.page.id)
          alariaArticles++
        }
      }
    })
  })
  nav.push({ id: 'worlds', label: 'Worlds', path: '/worlds', children: [alariaNav] })

  return {
    drafts, nav, diagnostics, unlisted, raceImages,
    inventory: { playerChapters: PLAYER_GROUPS.flatMap((g) => g.leaves).filter((l) => 'file' in l).length, gmChapters: GM_GROUPS.flatMap((g) => g.leaves).length, races: races.length, combat: combat.length, noncombat: noncombat.length, spells: spells.length, alariaArticles, alariaLandings },
  }
}

/** `Tags: a, b` line directly under the title. Replaced by a blank line so source line numbers stay true. */
function extractTags(text: string): { text: string; tags: string[] } {
  const lines = text.split('\n')
  const tags: string[] = []
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const m = /^Tags:\s*(.+)$/.exec(lines[i])
    if (m) { tags.push(...m[1].split(',').map((s) => s.trim()).filter(Boolean)); lines[i] = ''; break }
  }
  return { text: lines.join('\n'), tags }
}
