// The one loader for play's catalogues. It imports the compiler output, parses it at module load and throws
// on a schema mismatch, so a stale or malformed `packages/content` build fails the Worker at startup, not in a
// player's sheet. Run `pnpm --filter @heartrush/content build` if `dist` is missing.
import type { Catalogue, PlayCondition, PlayRace, PlayTalent } from '@heartrush/rules-engine/catalogue'
import conditionsJson from '@heartrush/content/play/conditions' with { type: 'json' }
import racesJson from '@heartrush/content/play/races' with { type: 'json' }
import talentsJson from '@heartrush/content/play/talents' with { type: 'json' }
import { PATHS, PATHS_BY_ID, type PlayPath } from './paths'
import { conditionsFileSchema, racesFileSchema, talentsFileSchema } from './schema'

export { PATHS, PATHS_BY_ID, type PlayPath }
export type { Catalogue, PlayCondition, PlayRace, PlayTalent }

/** A race as the loader returns it: ruling 15's `mentionsSpelltouched` is computed here, once. */
export type CatalogueRace = PlayRace & { mentionsSpelltouched: boolean }

export type PlayCatalogue = Catalogue & {
  contentVersion: string
  races: ReadonlyMap<string, CatalogueRace>
}

/** The rules site; a catalogue entry's `path` and a race's `image` are paths on it (ruling 23). */
export const RULES_ORIGIN = 'https://rules.heartrush.party'

export const rulebookUrl = (path: string): string => RULES_ORIGIN + path

/** The race image on the rules site, or null when the race has none. */
export const raceImageUrl = (race: Pick<PlayRace, 'image'>): string | null => (race.image ? RULES_ORIGIN + race.image : null)

/** INV-CATREF: a stored `{catalogueId, titleSnapshot}` resolves to its entry; when the id is null or no longer
 * resolves, `title` is the snapshot and `unresolved` is true ("no longer in the rulebook"). */
export function resolveRef<T extends { title: string }>(
  entries: ReadonlyMap<string, T>,
  ref: { catalogueId: string | null; titleSnapshot: string },
): { entry: T | null; title: string; unresolved: boolean } {
  const entry = ref.catalogueId === null ? undefined : entries.get(ref.catalogueId)
  return entry ? { entry, title: entry.title, unresolved: false } : { entry: null, title: ref.titleSnapshot, unresolved: true }
}

// Ruling 15: the toggle shows when the race's or a subrace's text mentions "spelltouched".
const SPELLTOUCHED = 'spelltouched'
const NON_TEXT_KEYS = new Set(['id', 'path', 'image'])
/** True when any text in `value` (strings, nested arrays and objects; not ids, paths or image paths) contains `needle`, case-insensitive. */
export function mentions(value: unknown, needle: string): boolean {
  if (typeof value === 'string') return value.toLowerCase().includes(needle)
  if (Array.isArray(value)) return value.some((v) => mentions(v, needle))
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => !NON_TEXT_KEYS.has(k) && mentions(v, needle))
  }
  return false
}

function byId<T extends { id: string }>(entries: readonly T[], kind: string): ReadonlyMap<string, T> {
  const map = new Map<string, T>()
  for (const e of entries) {
    if (map.has(e.id)) throw new Error(`play catalogue: duplicate ${kind} id ${e.id}`)
    map.set(e.id, e)
  }
  return map
}

function load(): PlayCatalogue {
  const talents = talentsFileSchema.parse(talentsJson)
  const races = racesFileSchema.parse(racesJson)
  const conditions = conditionsFileSchema.parse(conditionsJson)
  if (talents.contentVersion !== races.contentVersion || talents.contentVersion !== conditions.contentVersion) {
    throw new Error('play catalogue: talents, races and conditions come from different content builds')
  }
  return {
    contentVersion: talents.contentVersion,
    talents: byId(talents.entries, 'talent'),
    races: byId(races.entries.map((r) => ({ ...r, mentionsSpelltouched: mentions(r, SPELLTOUCHED) })), 'race'),
    conditions: byId(conditions.entries, 'condition'),
  }
}

const catalogue = load()

/** The parsed catalogue, assignable to the engine's `Catalogue`. Parsed once when this module loads. */
export const getCatalogue = (): PlayCatalogue => catalogue
