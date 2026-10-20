// Catalogue input types. The engine never loads a catalogue: callers pass these in (INV-PURE).
// They match the compiler output in packages/content/dist/catalogues/play/*.json (design Interfaces #8,
// plan rulings 9, 10, 16).
import type { AbilityId, Die, PurchaseKind } from './types'

export type AttunementLevel = 'basic' | 'advanced' | 'paragon'
export type TalentCategory = 'combat' | 'noncombat' | 'elemental'
export type Frequency = 'passive' | 'minor' | 'major' | 'weekly' | 'monthly'

/** Ruling 9: the talent's tradition, parsed by the compiler from the kind line. */
export type Tradition = 'Martial' | 'Cognitive' | 'Handmagic' | 'Gaeic melody'

/** A `cost` effect applies to `purchase`; `talent:*` covers the three talent kinds. */
export type EffectPurchase = PurchaseKind | 'talent:*'

/** Every present field must match the purchase (tradition from the talent's catalogue entry, honor from the aspect, ability from the die). */
export type CostWhere = { tradition?: Tradition; honor?: true; ability?: AbilityId }

export type RaceEffect =
  | { kind: 'cost'; purchase: EffectPurchase; delta: number; where?: CostWhere }
  | { kind: 'dieCap'; ability: AbilityId; max: Die }
  | { kind: 'aspectRankCap'; max: number }
  | { kind: 'awardBonus'; per: number; bonus: number }
  /** Ruling 16: grants one attunement in exactly one element; a race that offers two elements puts one `attunement` effect in each choice option. */
  | { kind: 'attunement'; elements: [string]; level: 'basic' }
  | { kind: 'manual'; text: string }

export type PlayAbility = {
  title: string
  frequency: Frequency | null
  body: string
  /** "You gain the <Title> talent as a racial ability": that catalogue talent, with its destiny level when the rule says so. */
  grants: { talentId: string; destiny: boolean } | null
}

/** A creation-time choice on a race or subrace. `options` picks one option; `talent` picks one catalogue talent, narrowed by `tradition`. */
export type PlayChoiceOption = { id: string; title: string; abilities: PlayAbility[]; effects: RaceEffect[] }
export type PlayChoice =
  | { id: string; title: string; text: string; kind: 'options'; options: PlayChoiceOption[] }
  | { id: string; title: string; text: string; kind: 'talent'; tradition: Tradition | null }

export type PlayTalent = {
  id: string
  path: string
  title: string
  category: TalentCategory
  frequency: Frequency | null
  /** Ruling 9. */
  tradition: Tradition | null
  /** Ruling 9: 25 spells name two elements. Empty for non-elemental talents. */
  elements: string[]
  /** Ruling 11: missing means basic. */
  attunementLevel?: AttunementLevel
  body: string
  destiny: string | null
}

export type PlaySubrace = {
  id: string
  title: string
  aspects: string[]
  abilities: PlayAbility[]
  choices: PlayChoice[]
  /** Ruling 16. */
  effects: RaceEffect[]
  baseMaxHp?: number
}

export type PlayRace = {
  id: string
  path: string
  title: string
  size: string | null
  image: string | null
  baseMaxHp?: number
  aspects: string[]
  abilities: PlayAbility[]
  choices: PlayChoice[]
  subraces: PlaySubrace[]
  effects: RaceEffect[]
}

export type PlayCondition = {
  id: string
  path: string
  title: string
  leveled: boolean
  fading: boolean
  ongoing: boolean
  /** Abilities that take an unconditional disadvantage per level; `'all'` for every ability. */
  penalizes: AbilityId[] | 'all' | null
  /** Situation-dependent penalty text, shown beside the ability rows, never counted. */
  situational: string | null
  body: string
}

export type ConditionCatalogue = ReadonlyMap<string, PlayCondition>

export type Catalogue = {
  talents: ReadonlyMap<string, PlayTalent>
  races: ReadonlyMap<string, PlayRace>
  conditions: ConditionCatalogue
}

export function indexById<T extends { id: string }>(entries: readonly T[]): ReadonlyMap<string, T> {
  return new Map(entries.map(e => [e.id, e]))
}
