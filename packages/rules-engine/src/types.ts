// The stored document (`character.state`), the builder draft, the Action union and RuleError.
// Nothing derived is stored here (INV-DERIVED). Field names follow the design's "Rules engine" TS.
import type { AttunementLevel, Frequency, RaceEffect, TalentCategory, Tradition } from './catalogue'

export type Die = 4 | 6 | 8 | 10 | 12
export type HeartDie = Die | 20
export type AbilityId = 'might' | 'agility' | 'cunning' | 'presence'
export type Size = 'H' | 'L' | 'UL'
export type DamageType = 'B' | 'S' | 'P'
export type AttackType = 'melee' | 'ranged' | 'thrown' | 'whip'
export type ArmorWeight = 'H' | 'M' | 'L' | 'none'
export type ShieldWeight = 'H' | 'L' | 'none'
export type AgeCategory = 'young' | 'adult' | 'elderly' | 'unspecified'

export const SCHEMA_VERSION = 1 as const

// ---- Pricing vocabulary ---------------------------------------------------------------------

export type PurchaseKind =
  | 'aspect:new' | 'aspect:rank' | 'hp' | 'die'
  | 'talent:combat' | 'talent:noncombat' | 'talent:elemental'
  | 'destiny' | 'path' | 'path:tier'

/** What a purchase acts on. `talent` carries catalogue facts the engine cannot look up (INV-PURE). */
export type Target = {
  ability?: AbilityId
  aspectId?: string
  /** Record id of an owned talent receiving a destiny level. */
  talentId?: string
  pathId?: string
  talent?: { tradition?: Tradition | null; elements?: string[]; attunementLevel?: AttunementLevel }
}

// ---- Stored document ------------------------------------------------------------------------

export type Identity = {
  name: string
  pronouns: string
  dream: string
  description: string
  motivation: string
  portrait: string | null
  ageCategory: AgeCategory
  /** Chosen age benefit ids. */
  ageBenefits: string[]
}

/** INV-CATREF: a catalogue reference keeps its title; an unresolved id renders the snapshot. */
export type Kin = { raceId: string; subraceId: string | null; titleSnapshot: string; spelltouched: boolean }

export type Attunement = { id: string; element: string; level: AttunementLevel; source: 'race' | string }

export type BloodmarkKind = 'specialization' | 'signature' | 'mastery' | 'paragon'
export type BloodmarkAbility = { id: string; kind: BloodmarkKind; title: string; text: string; grantedAtLevel: number }

export type Wound = { id: string; rank: number; description: string; treated: boolean; takenAt: string }

/**
 * A condition row. Catalogue rows have `conditionId`; custom rows have `conditionId: null` and `name`.
 * One condition may have several rows (for example a manual level and a sleep level); every row's level counts.
 */
export type Condition = {
  id: string
  conditionId: string | null
  name: string | null
  level: number | null
  permanent: boolean
  source: 'sleep' | 'manual'
  /** Abilities a custom condition penalizes; empty for catalogue rows. */
  affects: AbilityId[]
}

export type AspectSource = 'race' | 'age' | 'created' | 'purchased' | 'growth'
export type Aspect = { id: string; text: string; rank: number; source: AspectSource; honor: boolean }

export type Profession = { id: string; name: string; rank: number; challenges: number; missions: number; practiceWeeks: number }

export type TalentOrigin = TalentCategory | 'racial' | 'bloodmark' | 'path' | 'item' | 'custom'
export type Talent = {
  id: string
  catalogueId: string | null
  titleSnapshot: string
  category: TalentOrigin
  frequency: Frequency
  destiny: boolean
  customText: string | null
  usedThisPeriod: boolean
  usesThisFight: number
}

export type Weapon = {
  id: string
  name: string
  size: Size
  damageType: DamageType
  attackType: AttackType
  reach: boolean
  misc: number
  wielded: boolean
}
export type Armor = { name: string; weight: ArmorWeight; misc: number; worn: boolean }
export type Shield = { name: string; weight: ShieldWeight; misc: number; worn: boolean }
export type GearItem = { id: string; name: string; slots: number; quantity: number; notes: string }
export type Coins = { iron: number; obol: number; lire: number; ducat: number; crown: number }
export type Gear = { weapons: Weapon[]; armor: Armor; shield: Shield; items: GearItem[]; coins: Coins }

export type Purchase = {
  id: string
  kind: PurchaseKind
  /** The thing bought: the ability id, aspect id, talent record id or path id; null when there is none (hp, path:tier). */
  target: string | null
  cost: number
  at: string
}

export type Play = {
  round: number
  rushPoints: number
  /** 0–10. */
  dp: number
  baseSpeed: number
  staminaSpentRound: number | null
  failedRestStreak: number
  /** Young and Foolish sets 2. */
  dpPerComplication: 1 | 2
  /** Natural Learner sets −1. */
  professionChallengeDelta: 0 | -1
}

export type Character = {
  schemaVersion: typeof SCHEMA_VERSION
  draft: false
  identity: Identity
  kin: Kin
  attunements: Attunement[]
  path: { pathId: string; tier: 1 | 2 | 3 | 4 } | null
  bloodmarks: { level: number; abilities: BloodmarkAbility[] }
  abilities: Record<AbilityId, { start: 4 | 6; current: Die }>
  hp: { baseMax: number; current: number; heartDieCurrent: HeartDie }
  wounds: Wound[]
  conditions: Condition[]
  aspects: Aspect[]
  professions: Profession[]
  talents: Talent[]
  gear: Gear
  xp: { awarded: number; purchases: Purchase[] }
  play: Play
  raceEffects: RaceEffect[]
  notes: string
}

// ---- Builder draft (ruling 8) ---------------------------------------------------------------

/** Steps 1–5 of the builder. Every created record's id is `<id>:<n>` (ruling 6). */
export type BuilderInput = {
  /** The character's id; client-stamped (INV-DET). */
  id: string
  at: string
  name: string
  pronouns: string
  dream: string
  description: string
  motivation: string
  portrait: string | null
  raceId: string
  subraceId: string | null
  /** Picks the element when a racial `attunement` effect lists two (ruling 16). */
  attunementChoice?: string
  spelltouched: boolean
  /** Two d6 and two d4. */
  dice: Record<AbilityId, 4 | 6>
  ageCategory: 'young' | 'adult' | 'elderly'
  ageBenefits: string[]
  /** The aspect text Deep Knowledge adds at rank 3. */
  deepKnowledgeAspect?: string
  /** The two aspects the player writes. */
  createdAspects: [string, string]
  professions: Array<{ name: string; rank: number }>
  bloodmarkLevel: number
}

/** Ruling 8: a draft row's state. `pending` holds the step 6–7 actions, each stamped. */
export type DraftState = {
  schemaVersion: typeof SCHEMA_VERSION
  draft: true
  builder: BuilderInput
  pending: ClientAction[]
}

export type StoredState = Character | DraftState

// ---- Actions --------------------------------------------------------------------------------

/** Ruling 6: every action carries a client-stamped ULID `id` and ISO `at`. Created records get `<id>:<n>`. */
export type ActionBase = { id: string; at: string }

/** What `xp:buy` creates for a talent purchase (catalogue facts are passed, never looked up). */
export type BoughtTalent = {
  catalogueId: string | null
  titleSnapshot: string
  frequency: Frequency
  customText: string | null
  /** Elemental Affinity: the element attuned (basic when new, else one step up). */
  attunementElement?: string
}

export type CustomConditionFields = { name: string; affects: AbilityId[] }

export type ActionBody =
  | { kind: 'damage'; amount: number; woundDescription?: string }
  | { kind: 'heal'; amount: number }
  | { kind: 'setHp'; value: number }
  | { kind: 'wound:add'; wound: { rank: number; description?: string } }
  | { kind: 'wound:edit'; wound: Partial<Omit<Wound, 'id'>> & { id: string } }
  | { kind: 'wound:remove'; woundId: string }
  | { kind: 'wound:treat'; woundId: string; medicineRoll: number }
  /** Catalogue condition; level 0 removes; clamps 1–5. Acts on the manual-source row. */
  | { kind: 'condition:set'; conditionId: string; level: number | null; permanent?: boolean }
  /** Custom condition: `rowId` absent creates a row (needs `custom`); level 0 removes. */
  | { kind: 'condition:custom'; rowId?: string; custom?: CustomConditionFields; level: number | null; permanent?: boolean }
  | { kind: 'ability:use'; talentId: string }
  | { kind: 'rush:set' | 'dp:set' | 'round:set'; value: number }
  | { kind: 'heartDie:spend'; effect: 'endure' | 'focus' | 'surge' }
  | { kind: 'heartDie:set'; value: HeartDie }
  | { kind: 'nextRound' }
  | { kind: 'endFight' }
  | { kind: 'shortRest' }
  | { kind: 'longRest'; successful: true }
  | { kind: 'longRest'; successful: false; rolled: Array<'weakened' | 'off-balanced' | 'dazed'> }
  | { kind: 'startSession' }
  | { kind: 'xp:award'; amount: number }
  | { kind: 'xp:buy'; purchase: PurchaseKind; target?: Target; talent?: BoughtTalent; aspectText?: string }
  | { kind: 'bloodmark:award' }
  | { kind: 'bloodmark:pick'; ability: { kind: BloodmarkKind; title: string; text: string } }
  | { kind: 'gear:weapon:add'; weapon: Omit<Weapon, 'id'> }
  | { kind: 'gear:weapon:edit'; weapon: Partial<Omit<Weapon, 'id'>> & { id: string } }
  | { kind: 'gear:weapon:remove'; weaponId: string }
  /** Exactly one wielded weapon; `null` unwields all. */
  | { kind: 'gear:wield'; weaponId: string | null }
  | { kind: 'gear:armor:set'; armor: Partial<Armor> }
  | { kind: 'gear:shield:set'; shield: Partial<Shield> }
  | { kind: 'gear:wear'; piece: 'armor' | 'shield'; worn: boolean }
  | { kind: 'gear:item:add'; item: Omit<GearItem, 'id'> }
  | { kind: 'gear:item:edit'; item: Partial<Omit<GearItem, 'id'>> & { id: string } }
  | { kind: 'gear:item:remove'; itemId: string }
  | { kind: 'gear:coins:set'; coins: Partial<Coins> }
  /** New aspects and rank changes come only through `xp:buy`; these two edit text and honor or delete. */
  | { kind: 'aspect:edit'; aspect: { id: string; text?: string; honor?: boolean } }
  | { kind: 'aspect:remove'; aspectId: string }
  | { kind: 'profession:add'; profession: Partial<Omit<Profession, 'id'>> & { name: string } }
  | { kind: 'profession:edit'; profession: Partial<Omit<Profession, 'id'>> & { id: string } }
  | { kind: 'profession:remove'; professionId: string }
  /** Progress counters (spec §5): +1 challenge, +1 practice week, mission tick, and the rank-up that resets all three. */
  | { kind: 'profession:challenge'; professionId: string }
  | { kind: 'profession:practice'; professionId: string }
  | { kind: 'profession:mission'; professionId: string; done: boolean }
  | { kind: 'profession:advance'; professionId: string }
  /** Descriptive fields only: age category and benefits are fixed once the builder finishes. */
  | { kind: 'identity:set'; identity: Partial<Pick<Identity, 'name' | 'pronouns' | 'dream' | 'description' | 'motivation' | 'portrait'>> }
  | { kind: 'notes:set'; notes: string }
  | { kind: 'raceEffects:set'; effects: RaceEffect[] }
  | { kind: 'attunement:set'; attunements: Attunement[] }
  /** Internal: the stored inverse of an event, and the undo of an event. Never accepted from a client (INV-INTERNAL). */
  | { kind: 'undo'; of: string }
  | { kind: 'restore'; slices: Partial<Character> }

export type Action = ActionBody & ActionBase
export type RestoreAction = Extract<Action, { kind: 'restore' }>
/** What a client may send to `applyCharacterAction`. */
export type ClientAction = Exclude<Action, { kind: 'restore' | 'undo' }>
/** The stored inverse: the previous value of every top-level key the action changed (ruling 7). */
export type Inverse = { kind: 'restore'; slices: Partial<Character> }

// ---- Errors ---------------------------------------------------------------------------------

export type RuleErrorCode =
  // pricing
  | 'aspect_cap' | 'die_cap' | 'not_attuned' | 'insufficient_xp' | 'path_locked' | 'no_path' | 'tier_cap'
  // reducers
  | 'not_found' | 'invalid_amount' | 'not_enough_rush' | 'stamina_spent' | 'heart_die_floor' | 'heart_die_over_max'
  | 'wrong_rolled_count' | 'bloodmark_not_owed' | 'not_ready'
  // createCharacter
  | 'unknown_race' | 'unknown_subrace' | 'invalid_age_benefits' | 'invalid_dice' | 'invalid_professions' | 'attunement_choice'
  // undo and client input
  | 'not_top_of_stack' | 'bad_action'

export class RuleError extends Error {
  readonly code: RuleErrorCode
  constructor(code: RuleErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'RuleError'
    this.code = code
  }
}
