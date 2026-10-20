// Pure XP and bloodmark reducers. The action supplies every new row's id and timestamp (ruling 6).
// `xp:buy` creates in this order: the purchase `<id>:0`, then the aspect or talent it appends `<id>:1`,
// then, for Elemental Affinity on a new element, the attunement `<id>:2`.
import { bloodmarkPicksOwed, hasWarcaster } from '../bloodmarks'
import { price, xpRemaining } from '../pricing'
import { RuleError } from '../types'
import type { Action, Attunement, Character, Die, Purchase, Talent } from '../types'

type Of<K extends Action['kind']> = Extract<Action, { kind: K }>

/** Magic.md: the nine elements. */
const ELEMENTS = ['fire', 'water', 'air', 'earth', 'light', 'dark', 'force', 'void', 'time']

export function xpAward(c: Character, a: Of<'xp:award'>): Character {
  if (!Number.isSafeInteger(a.amount) || a.amount < 1) throw new RuleError('invalid_amount')
  const bonus = c.raceEffects.reduce((sum, e) => e.kind === 'awardBonus' ? sum + Math.floor(a.amount / e.per) * e.bonus : sum, 0)
  return { ...c, xp: { ...c.xp, awarded: c.xp.awarded + a.amount + bonus } }
}

function elementName(element: string): string {
  const name = element.trim().toLowerCase()
  if (!ELEMENTS.includes(name)) throw new RuleError('bad_action', `Unknown element: ${element}`)
  return name
}

/** Elemental Affinity (Elemental_Affinity.md): a new element is basic; an element at basic becomes advanced. */
function attune(c: Character, element: string, id: string): Attunement[] {
  const name = elementName(element)
  const existing = c.attunements.find(x => x.element.toLowerCase() === name)
  if (!existing) return [...c.attunements, { id, element: name, level: 'basic', source: 'talent' }]
  if (existing.level !== 'basic') throw new RuleError('bad_action', 'Elemental Affinity raises only a basic attunement')
  return c.attunements.map(x => x === existing ? { ...x, level: 'advanced' } : x)
}

export function xpBuy(c: Character, a: Of<'xp:buy'>): Character {
  const { purchase: kind, target, talent: bought, aspectText } = a
  const isTalent = kind === 'talent:combat' || kind === 'talent:noncombat' || kind === 'talent:elemental'
  if (isTalent !== (bought !== undefined)) throw new RuleError('bad_action', 'A talent purchase needs talent fields, and only a talent purchase takes them')
  if (bought && !bought.titleSnapshot.trim()) throw new RuleError('bad_action', 'Talent title is blank')
  if (bought?.attunementElement !== undefined && kind !== 'talent:noncombat') throw new RuleError('bad_action', 'Only Elemental Affinity attunes')
  if ((kind === 'aspect:new') !== (aspectText !== undefined)) throw new RuleError('bad_action', 'Only a new aspect takes aspectText')
  if (aspectText !== undefined && !aspectText.trim()) throw new RuleError('bad_action', 'Aspect text is blank')
  if (kind === 'path' && !target?.pathId) throw new RuleError('bad_action', 'A path purchase names the path')
  if (kind === 'destiny') {
    if (!target?.talentId) throw new RuleError('bad_action', 'Destiny names an owned talent')
    const owned = c.talents.find(t => t.id === target.talentId)
    if (!owned) throw new RuleError('not_found')
    if (owned.destiny) throw new RuleError('bad_action', 'Talent already has its destiny level')
  }

  const cost = price(c, kind, target)
  if (cost > xpRemaining(c)) throw new RuleError('insufficient_xp')

  const purchaseId = `${a.id}:0`
  const createdId = `${a.id}:1`
  const record = (targetId: string | null): Purchase => ({ id: purchaseId, kind, target: targetId, cost, at: a.at })
  const spend = (targetId: string | null, changes: Partial<Character>): Character =>
    ({ ...c, ...changes, xp: { ...c.xp, purchases: [...c.xp.purchases, record(targetId)] } })

  switch (kind) {
    case 'hp': return spend(null, {})
    case 'die': {
      const ability = target!.ability!
      const next = (c.abilities[ability].current + 2) as Die
      return spend(ability, { abilities: { ...c.abilities, [ability]: { ...c.abilities[ability], current: next } } })
    }
    case 'aspect:new':
      return spend(createdId, { aspects: [...c.aspects, { id: createdId, text: aspectText!.trim(), rank: 1, source: 'purchased', honor: false }] })
    case 'aspect:rank': {
      const id = target!.aspectId!
      return spend(id, { aspects: c.aspects.map(x => x.id === id ? { ...x, rank: x.rank + 1 } : x) })
    }
    case 'destiny': {
      const id = target!.talentId!
      return spend(id, { talents: c.talents.map(t => t.id === id ? { ...t, destiny: true } : t) })
    }
    case 'path': return spend(target!.pathId!, { path: { pathId: target!.pathId!, tier: 1 } })
    case 'path:tier': return spend(null, { path: { pathId: c.path!.pathId, tier: (c.path!.tier + 1) as 2 | 3 | 4 } })
    case 'talent:combat':
    case 'talent:noncombat':
    case 'talent:elemental': {
      const b = bought!
      const talent: Talent = {
        id: createdId, catalogueId: b.catalogueId, titleSnapshot: b.titleSnapshot.trim(), category: kind.slice('talent:'.length) as Talent['category'],
        frequency: b.frequency, destiny: false, customText: b.customText, usedThisPeriod: false, usesThisFight: 0,
      }
      const changes: Partial<Character> = { talents: [...c.talents, talent] }
      if (b.attunementElement !== undefined) changes.attunements = attune(c, b.attunementElement, `${a.id}:2`)
      return spend(createdId, changes)
    }
  }
}

export function bloodmarkAward(c: Character, _a: Of<'bloodmark:award'>): Character {
  return { ...c, bloodmarks: { ...c.bloodmarks, level: c.bloodmarks.level + 1 } }
}

export function bloodmarkPick(c: Character, a: Of<'bloodmark:pick'>): Character {
  const title = a.ability.title.trim()
  if (!title) throw new RuleError('bad_action', 'Ability title is blank')
  if (bloodmarkPicksOwed(c)[a.ability.kind] <= 0) throw new RuleError('bloodmark_not_owed')
  const ability = { id: `${a.id}:0`, kind: a.ability.kind, title, text: a.ability.text, grantedAtLevel: c.bloodmarks.level }
  const picked = { ...c, bloodmarks: { ...c.bloodmarks, abilities: [...c.bloodmarks.abilities, ability] } }
  // Warcaster grants a basic attunement of the chosen element (Building_Your_Character.md).
  if (!hasWarcaster({ ...c, bloodmarks: { ...c.bloodmarks, abilities: [ability] } })) return picked
  if (a.ability.element === undefined) throw new RuleError('bad_action', 'Warcaster needs an element')
  const element = elementName(a.ability.element)
  if (c.attunements.some(x => x.element.toLowerCase() === element)) throw new RuleError('bad_action', `Already attuned to ${element}`)
  return { ...picked, attunements: [...c.attunements, { id: `${a.id}:1`, element, level: 'basic', source: ability.id }] }
}
