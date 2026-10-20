import { hasWarcaster } from './bloodmarks'
import { maxHp } from './derived'
import type { AbilityId, Character, Die, PriceTarget, PurchaseKind, TalentFacts } from './types'
import { RuleError } from './types'
import type { AttunementLevel, CostWhere } from './catalogue'

const talentKind = (kind: PurchaseKind) => kind === 'talent:combat' || kind === 'talent:noncombat' || kind === 'talent:elemental'

function matches(c: Character, where: CostWhere | undefined, t: PriceTarget | undefined): boolean {
  if (!where) return true
  if (where.ability && where.ability !== t?.ability) return false
  if (where.tradition && where.tradition !== t?.talent?.tradition) return false
  if (where.honor && !c.aspects.some(a => a.id === t?.aspectId && a.honor)) return false
  return true
}

export function raceDelta(c: Character, kind: PurchaseKind, t?: PriceTarget): number {
  return c.raceEffects.reduce((sum, e) => e.kind === 'cost' &&
    (e.purchase === kind || (e.purchase === 'talent:*' && talentKind(kind))) && matches(c, e.where, t)
    ? sum + e.delta : sum, 0)
}

export function dieCap(c: Character, ability: AbilityId): Die {
  return Math.min(12, ...c.raceEffects.flatMap(e => e.kind === 'dieCap' && e.ability === ability ? [e.max] : [])) as Die
}

export function aspectRankCap(c: Character): number {
  return Math.max(5, ...c.raceEffects.filter(e => e.kind === 'aspectRankCap').map(e => e.max))
}

const ATTUNEMENT_LEVEL: Record<AttunementLevel, number> = { basic: 0, advanced: 1, paragon: 2 }
/** Ruling 17: at least one named element is sufficient. A missing level requires basic (ruling 11). */
export function requireAttunement(c: Character, talent: TalentFacts): void {
  const required = ATTUNEMENT_LEVEL[talent.attunementLevel ?? 'basic']
  if (!talent.elements?.some(element => c.attunements.some(a => a.element.toLowerCase() === element.toLowerCase() && ATTUNEMENT_LEVEL[a.level] >= required))) {
    throw new RuleError('not_attuned')
  }
}

export function count(c: Character, category: 'combat' | 'noncombat' | 'elemental'): number {
  return c.talents.filter(t => t.category === category).length
}

export function destinyLevels(c: Character): number {
  return c.talents.filter(t => t.destiny).length
}

export function price(c: Character, kind: PurchaseKind, t?: PriceTarget): number {
  let base: number
  switch (kind) {
    case 'aspect:new': base = 1; break
    case 'aspect:rank': {
      const aspect = c.aspects.find(a => a.id === t?.aspectId)
      if (!aspect) throw new RuleError('not_found')
      if (aspect.rank >= aspectRankCap(c)) throw new RuleError('aspect_cap')
      base = aspect.rank + 1
      break
    }
    case 'hp': base = maxHp(c) / 10 + 1; break
    case 'die': {
      if (!t?.ability) throw new RuleError('bad_action')
      const current = c.abilities[t.ability].current
      if (current >= dieCap(c, t.ability)) throw new RuleError('die_cap')
      base = current + 2
      break
    }
    case 'talent:combat': base = count(c, 'combat') + 3; break
    case 'talent:noncombat': base = count(c, 'noncombat') + 3; break
    case 'talent:elemental':
      if (!t?.talent) throw new RuleError('not_attuned')
      requireAttunement(c, t.talent)
      base = hasWarcaster(c) ? count(c, 'elemental') + 3 : 2 * count(c, 'combat') + 3
      break
    case 'destiny': base = destinyLevels(c) + 5; break
    case 'path':
      if (c.xp.awarded < 50) throw new RuleError('path_locked')
      if (c.path) throw new RuleError('path_locked')
      base = Math.max(10, Math.ceil(c.xp.awarded * 0.2))
      break
    case 'path:tier':
      if (!c.path) throw new RuleError('no_path')
      if (c.path.tier >= 4) throw new RuleError('tier_cap')
      base = c.path.tier === 1 ? 12 : c.path.tier === 2 ? 16 : 20
      break
  }
  return Math.max(1, base + raceDelta(c, kind, t))
}

export function xpSpent(c: Character): number {
  return c.xp.purchases.reduce((sum, p) => sum + p.cost, 0)
}

export function xpRemaining(c: Character): number {
  return c.xp.awarded - xpSpent(c)
}

/** Only purchased kinds are present; no zero entries are added. */
export function xpByKind(c: Character): Partial<Record<PurchaseKind, number>> {
  const sums: Partial<Record<PurchaseKind, number>> = {}
  for (const p of c.xp.purchases) sums[p.kind] = (sums[p.kind] ?? 0) + p.cost
  return sums
}
