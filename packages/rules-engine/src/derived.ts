// Derived values. Pure functions over a Character (INV-PURE); none of these results is ever stored (INV-DERIVED).
import type { ConditionCatalogue, PlayCondition } from './catalogue'
import { CONDITION, hasCondition } from './conditions'
import type {
  AbilityId, ArmorWeight, Character, Condition, DamageType, ShieldWeight, Size, Talent,
} from './types'

// --- Weapon dice per stance (Weapons,_Cantrips,_&_Armor.md: base die by size; two dice when the damage type matches the stance)
const SIZE_DIE: Record<Size, number> = { H: 12, L: 8, UL: 4 }
const STANCE_FOR_TYPE: Record<DamageType, AbilityId> = { B: 'might', S: 'agility', P: 'cunning' }

/** The wielded weapon's dice for a stance, or null (shown as "—") when nothing is wielded. */
export function weaponDice(c: Character, stance: 'might' | 'agility' | 'cunning'): string | null {
  const w = c.gear.weapons.find(w => w.wielded)
  if (!w) return null
  const count = STANCE_FOR_TYPE[w.damageType] === stance ? 2 : 1
  const misc = w.misc ? `+${w.misc}` : ''
  return `${count}d${SIZE_DIE[w.size]}${misc}`
}

// --- Defense bonus
const ARMOR_DEF: Record<ArmorWeight, number> = { H: 6, M: 4, L: 2, none: 0 }
const SHIELD_DEF: Record<ShieldWeight, number> = { H: 2, L: 1, none: 0 }

export function defenseBonus(c: Character): number {
  const a = c.gear.armor, s = c.gear.shield
  return (a.worn ? ARMOR_DEF[a.weight] + a.misc : 0) + (s.worn ? SHIELD_DEF[s.weight] + s.misc : 0)
}

// --- Speed
const ARMOR_SPEED: Record<ArmorWeight, number> = { H: 15, M: 10, L: 5, none: 0 }

export function speed(c: Character): number {
  const a = c.gear.armor, s = c.gear.shield
  const wielded = c.gear.weapons.find(w => w.wielded)
  let v = c.play.baseSpeed
    - (a.worn ? ARMOR_SPEED[a.weight] : 0)
    - (s.worn && s.weight === 'H' ? 5 : 0)
    - (wielded?.size === 'H' ? 5 : 0)
  if (hasCondition(c, CONDITION.restrained)) return 0
  if (hasCondition(c, CONDITION.crippled)) return Math.max(0, Math.min(v, 5))
  if (hasCondition(c, CONDITION.slowed)) v = v / 2
  return Math.max(0, Math.floor(v / 5) * 5)
}

// --- Disadvantage per ability from conditions
const levelOf = (cond: Condition) => cond.level ?? 1

function penalizes(cond: Condition, ability: AbilityId, catalogue: ConditionCatalogue): boolean {
  if (cond.conditionId === null) return cond.affects.includes(ability)
  const entry = catalogue.get(cond.conditionId)
  if (!entry) return false
  return entry.penalizes === 'all' || (entry.penalizes?.includes(ability) ?? false)
}

/** Levels of disadvantage on an ability: every row's level counts (a condition may have a manual row and a sleep row). */
export function disadvantage(c: Character, ability: AbilityId, catalogue: ConditionCatalogue): number {
  return c.conditions.reduce((n, cond) => n + (penalizes(cond, ability, catalogue) ? levelOf(cond) : 0), 0)
}

export type SituationalLine = { conditionId: string; title: string; level: number; text: string }

/** Catalogue conditions on the character whose penalty depends on the situation. Listed, never counted. One line per condition. */
export function situational(c: Character, catalogue: ConditionCatalogue): SituationalLine[] {
  const lines = new Map<string, SituationalLine>()
  for (const cond of c.conditions) {
    if (cond.conditionId === null) continue
    const entry: PlayCondition | undefined = catalogue.get(cond.conditionId)
    if (!entry?.situational) continue
    const line = lines.get(entry.id)
    if (line) line.level += levelOf(cond)
    else lines.set(entry.id, { conditionId: entry.id, title: entry.title, level: levelOf(cond), text: entry.situational })
  }
  return [...lines.values()]
}

// --- HP
export function woundPenalty(c: Character): number {
  return c.wounds.reduce((s, w) => s + w.rank, 0)
}
export function maxHp(c: Character): number {
  return c.hp.baseMax + 10 * c.xp.purchases.filter(p => p.kind === 'hp').length
}
export function effectiveMaxHp(c: Character): number {
  return maxHp(c) - woundPenalty(c)
}
/** Combat.md: dead at −max HP; wounds do not move it. */
export function deathThreshold(c: Character): number {
  return -maxHp(c)
}

// --- Heart die (Experience_&_Advancement.md automatic progression)
export function maxHeartDie(c: Character): 8 | 10 | 12 | 20 {
  const xp = c.xp.awarded
  return xp >= 1000 ? 20 : xp >= 500 ? 12 : xp >= 200 ? 10 : 8
}

// --- Slots (Equipment_&_Gear.md; design D5)
const WEAPON_SLOTS: Record<Size, number> = { H: 2, L: 1, UL: 0.2 }
const ARMOR_SLOTS: Record<ArmorWeight, number> = { H: 6, M: 3, L: 1, none: 0 }

export function slotCapacity(c: Character): number {
  return 6 + c.abilities.might.current / 2
}
export function slotsUsed(c: Character): number {
  const total = c.gear.weapons.reduce((s, w) => s + WEAPON_SLOTS[w.size], 0)
    + ARMOR_SLOTS[c.gear.armor.weight]
    + (c.gear.shield.weight === 'none' ? 0 : 1)
    + c.gear.items.reduce((s, i) => s + i.slots * i.quantity, 0)
  return Math.round(total * 100) / 100 // 0.2-slot sums drift in binary floating point
}

// --- Minor ability rush-point cost (Abilities.md): the n-th use this fight costs n.
export function minorUseCost(t: Pick<Talent, 'usesThisFight'>): number {
  return t.usesThisFight + 1
}
