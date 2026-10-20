// What differs between the three catalogues: wording, the facets they filter on (and the URL parameter for each),
// and the table columns. Everything else is shared by catalogue-page.tsx and entry-page.tsx.
import type { CatalogueEntry, CatalogueKind, RaceFacets, TalentFacets } from '@heartrush/content/types'

export type FacetDef = {
  /** Key in `catalogues/<kind>.json` `facets` and in each entry's `facets`. */
  key: string
  /** URL search parameter holding the selected values. */
  param: string
  /** Visible facet name. */
  label: string
  /** Display label for a value; defaults to the compiler's label. */
  valueLabel?: (value: string) => string | undefined
}

export type Column = { header: string; cell: (entry: CatalogueEntry) => string | null; numeric?: boolean }

export type CatalogueConfig = {
  kind: CatalogueKind
  path: string
  /** Lowercase plural for counts and the Back link: "talents". */
  noun: string
  title: string
  /** One line under the title. */
  lede: string
  aboutHeading: string
  /** "Back to <this>" on an entry page. */
  backLabel: string
  searchLabel: string
  facets: FacetDef[]
  /** Columns after Name. */
  columns: Column[]
  /** Page kind of an entry; a detail route 404s on any other kind. */
  entryKind: 'talent' | 'spell' | 'race'
}

const talent = (e: CatalogueEntry) => e.facets as TalentFacets
const list = (values: string[]) => (values.length ? values.join(', ') : null)
const abilityType = (e: CatalogueEntry) => list(talent(e).abilityTypes)

export const CATALOGUES: Record<CatalogueKind, CatalogueConfig> = {
  talents: {
    kind: 'talents',
    path: '/player/talents',
    noun: 'talents',
    title: 'Talents',
    lede: 'Browse the martial, cognitive, handmagic and Gaeic melody talents your character can learn.',
    aboutHeading: 'About talents',
    backLabel: 'talents',
    searchLabel: 'Search talents',
    entryKind: 'talent',
    facets: [
      { key: 'collection', param: 'group', label: 'Combat or noncombat', valueLabel: (v) => ({ combat: 'Combat', noncombat: 'Noncombat' })[v] },
      { key: 'abilityTypes', param: 'type', label: 'Ability type' },
      { key: 'traditions', param: 'tradition', label: 'Tradition' },
      { key: 'timing', param: 'timing', label: 'Timing' },
    ],
    columns: [
      { header: 'Ability type', cell: abilityType },
      { header: 'Tradition', cell: (e) => list(talent(e).traditions) },
    ],
  },
  spells: {
    kind: 'spells',
    path: '/player/spells',
    noun: 'spells',
    title: 'Spells',
    lede: 'Browse elemental talents by element, ability type and timing.',
    aboutHeading: 'About spells',
    backLabel: 'spells',
    searchLabel: 'Search spells',
    entryKind: 'spell',
    facets: [
      { key: 'elements', param: 'element', label: 'Element' },
      { key: 'abilityTypes', param: 'type', label: 'Ability type' },
      { key: 'timing', param: 'timing', label: 'Timing' },
      { key: 'ongoing', param: 'ongoing', label: 'Ongoing', valueLabel: (v) => ({ true: 'Ongoing', false: 'Not ongoing' })[v] },
    ],
    columns: [
      { header: 'Elements', cell: (e) => list(talent(e).elements) },
      { header: 'Ability type', cell: abilityType },
    ],
  },
  'kin-culture': {
    kind: 'kin-culture',
    path: '/player/kin-culture',
    noun: 'kin',
    title: 'Kin & culture',
    lede: 'Browse the kin your character can be born to, with their abilities and cultures.',
    aboutHeading: 'About kin & culture',
    backLabel: 'kin & culture',
    searchLabel: 'Search kin & culture',
    entryKind: 'race',
    facets: [{ key: 'size', param: 'size', label: 'Size' }],
    columns: [
      { header: 'Size', cell: (e) => (e.facets as RaceFacets).size },
      { header: 'Description', cell: (e) => e.description },
    ],
  },
}

/** Normalized labels for an entry's metadata line on its detail page: [field, value] pairs, unknown fields omitted. */
export function metadataLabels(kind: CatalogueKind, facets: TalentFacets | RaceFacets): Array<[string, string]> {
  if (kind === 'kin-culture') {
    const size = (facets as RaceFacets).size
    return [['Size', size ?? 'Not specified']]
  }
  const f = facets as TalentFacets
  const out: Array<[string, string]> = []
  if (f.abilityTypes.length) out.push(['Ability type', f.abilityTypes.join(', ')])
  if (f.timing.length) out.push(['Timing', f.timing.join(', ')])
  if (f.traditions.length) out.push(['Tradition', f.traditions.join(', ')])
  if (f.elements.length) out.push(['Element', f.elements.join(', ')])
  if (kind === 'spells' && f.ongoing !== null) out.push(['Ongoing', f.ongoing ? 'Yes' : 'No'])
  return out
}
