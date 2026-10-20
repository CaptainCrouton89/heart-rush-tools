// Emitted JSON schema for packages/content. Normative contract: rules-site-design "Data model".
export const SCHEMA_VERSION = 1 as const

export type Scope = 'player' | 'gm' | 'world:alaria'
export type PageKind = 'chapter' | 'landing' | 'talent' | 'spell' | 'race' | 'worldArticle' | 'catalogue'
export type CatalogueKind = 'talents' | 'spells' | 'kin-culture'
export type FilterKind = 'rules' | 'talents' | 'spells' | 'kin' | 'world'

// ---- Body tree -------------------------------------------------------------
export type LinkTarget = { id: string; path: string; anchor: string | null; previewId: string }

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'emphasis'; children: Inline[] }
  | { type: 'strong'; children: Inline[] }
  | { type: 'delete'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'dice'; value: string; label: string }
  | { type: 'lineBreak' }
  | { type: 'link'; url: string; external: boolean; target: LinkTarget | null; origin: 'explicit' | 'term'; children: Inline[] }

export type Range = [startLine: number, endLine: number]

export type Block =
  | { type: 'paragraph'; id: string; range: Range; children: Inline[] }
  | { type: 'heading'; id: string; range: Range; depth: number; children: Inline[] }
  | { type: 'list'; id: string; range: Range; ordered: boolean; start: number | null; children: ListItem[] }
  | { type: 'table'; id: string; range: Range; align: Array<'left' | 'right' | 'center' | null>; header: Inline[][]; rows: Inline[][][] }
  | { type: 'blockquote'; id: string; range: Range; children: Block[] }
  | { type: 'callout'; id: string; range: Range; calloutKind: 'example' | 'note' | 'warning'; title: string | null; children: Block[] }
  | { type: 'image'; id: string; range: Range; src: string; alt: string; width: number | null; height: number | null }
  | { type: 'codeBlock'; id: string; range: Range; lang: string | null; value: string }
  | { type: 'thematicBreak'; id: string; range: Range }

export type ListItem = { type: 'listItem'; id: string; range: Range; checked: boolean | null; children: Block[] }

// ---- Pages ---------------------------------------------------------------
export type Heading = { id: string; text: string; depth: number; parentId: string | null }
export type Crumb = { title: string; path: string }
export type SourceRef = { path: string; startLine: number; endLine: number }
export type CrossRef = { sourceNodeId: string; targetId: string; path: string; anchor: string | null; label: string; previewId: string; origin: 'explicit' | 'term' }

export type ChildSummary = { id: string; path: string; title: string; description: string | null; readingMinutes: number; kind: PageKind }

export type Page = {
  id: string
  slug: string
  path: string
  title: string
  navTitle: string
  description: string | null
  kind: PageKind
  scope: Scope
  worldId: string | null
  audience: 'all' | 'player' | 'gm'
  categoryId: string | null
  parentId: string | null
  order: number
  breadcrumbs: Crumb[]
  source: SourceRef | null
  sourceParts: SourceRef[]
  body: Block[]
  headings: Heading[]
  crossRefs: CrossRef[]
  aliases: string[]
  tags: string[]
  wordCount: number
  readingMinutes: number
  children: string[]
  /** Row data for each child, in `children` order, so a landing never fetches child bodies. */
  childSummaries: ChildSummary[]
  previous: string | null
  next: string | null
  image: { src: string; alt: string; width: number; height: number } | null
  facets: TalentFacets | RaceFacets | null
  rawMetadata: string | null
}

export type PageFile = Page & { schemaVersion: typeof SCHEMA_VERSION; contentVersion: string }

// ---- Manifest -------------------------------------------------------------
export type NavNode = { id: string; label: string; path: string; external?: boolean; children: NavNode[] }
export type ManifestPage = { id: string; path: string; kind: PageKind; scope: Scope; dataPath: string }

export type Manifest = {
  schemaVersion: typeof SCHEMA_VERSION
  contentVersion: string
  pages: ManifestPage[]
  routes: Record<string, string>
  characterSheetUrl: string
  worlds: Array<{ id: string; title: string; path: string; mapUrl: string }>
  navigation: NavNode[]
  sources: Record<string, string[]>
}

// ---- Catalogues -----------------------------------------------------------
export type FacetValue = { value: string; label: string; count: number }
export type Facet = { key: string; values: FacetValue[] }

export type TalentFacets = {
  collection: 'combat' | 'noncombat' | 'spells'
  abilityTypes: string[]
  traditions: string[]
  elements: string[]
  timing: string[]
  ongoing: boolean | null
  hasDestinyUpgrade: boolean
}
export type RaceFacets = { size: string | null }

export type CatalogueEntry = {
  id: string
  path: string
  title: string
  description: string | null
  aliases: string[]
  rawMetadata: string | null
  facets: TalentFacets | RaceFacets
  searchText: string
}

export type CatalogueFile = {
  schemaVersion: typeof SCHEMA_VERSION
  contentVersion: string
  kind: CatalogueKind
  entries: CatalogueEntry[]
  facets: Facet[]
}

// ---- Previews / glossary / diagnostics ----------------------------------------
export type PreviewFile = {
  schemaVersion: typeof SCHEMA_VERSION
  contentVersion: string
  targetId: string
  path: string
  anchor: string | null
  title: string
  breadcrumbs: Crumb[]
  excerptText: string
  truncated: boolean
}

export type GlossaryTarget = { id: string; path: string; anchor: string | null; title: string; kind: PageKind | 'heading'; scope: Scope }
export type GlossaryFile = { schemaVersion: typeof SCHEMA_VERSION; contentVersion: string; terms: Record<string, GlossaryTarget[]> }

export type Diagnostic = { level: 'warn' | 'info'; code: string; message: string; source?: { path: string; line: number } }

// ---- Search build input (consumed into Pagefind; never shipped as JSON) --------
export type SearchRecord = {
  targetId: string
  path: string
  anchor: string | null
  title: string
  aliases: string[]
  breadcrumbs: string[]
  scope: Scope
  kind: PageKind
  filterKind: FilterKind
  tags: string[]
  text: string
}

// ---- Play catalogues (consumed by play.heartrush.party) ---------------------------
export type RaceEffect =
  | { kind: 'cost'; purchase: 'aspect:new' | 'aspect:rank' | 'hp' | 'die' | 'talent:combat' | 'talent:noncombat' | 'talent:elemental' | 'talent:*' | 'destiny' | 'path' | 'path:tier'; delta: number; where?: { tradition?: 'Martial' | 'Cognitive' | 'Handmagic' | 'Gaeic melody'; honor?: true; ability?: 'might' | 'agility' | 'cunning' | 'presence' } }
  | { kind: 'dieCap'; ability: 'might' | 'agility' | 'cunning' | 'presence'; max: 4 | 6 | 8 | 10 | 12 }
  | { kind: 'aspectRankCap'; max: number }
  | { kind: 'awardBonus'; per: number; bonus: number }
  /** Exactly one element. A race that offers a pick (Nuun) expresses it as a choice. */
  | { kind: 'attunement'; elements: [string]; level: 'basic' | 'advanced' | 'paragon' }
  | { kind: 'manual'; text: string }

/** A racial ability that hands out a catalogue talent ("you gain the <Title> talent as a racial ability"); null when it grants none. */
export type PlayGrant = { talentId: string; destiny: boolean }
export type PlayAbility = { title: string; frequency: string | null; body: string; grants: PlayGrant | null }
export type PlayChoiceOption = { id: string; title: string; abilities: PlayAbility[]; effects: RaceEffect[] }
/** A choice the race text requires at character creation. `options`: pick one option. `talent`: pick one catalogue talent (narrowed by `tradition`). */
export type PlayChoice =
  | { id: string; title: string; text: string; kind: 'options'; options: PlayChoiceOption[] }
  | { id: string; title: string; text: string; kind: 'talent'; tradition: 'Martial' | 'Cognitive' | 'Handmagic' | 'Gaeic melody' | null }
export type PlayTalent = {
  id: string; path: string; title: string
  category: 'combat' | 'noncombat' | 'elemental'
  frequency: string | null
  tradition: 'Martial' | 'Cognitive' | 'Handmagic' | 'Gaeic melody' | null
  elements: string[]
  attunementLevel?: 'basic' | 'advanced' | 'paragon'
  body: string; destiny: string | null
}
export type PlayRace = {
  id: string; path: string; title: string; size: string | null; image: string | null
  baseMaxHp?: number
  aspects: string[]
  abilities: PlayAbility[]
  subraces: Array<{ id: string; title: string; aspects: string[]; abilities: PlayAbility[]; choices: PlayChoice[]; effects: RaceEffect[]; baseMaxHp?: number }>
  choices: PlayChoice[]
  effects: RaceEffect[]
}
export type PlayCondition = {
  id: string; path: string; title: string
  leveled: boolean; fading: boolean; ongoing: boolean
  penalizes: string[] | 'all' | null
  situational: string | null
  body: string
}
export type PlayFile<T> = { schemaVersion: typeof SCHEMA_VERSION; contentVersion: string; entries: T[] }
