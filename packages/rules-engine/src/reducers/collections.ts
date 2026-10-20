// Collection reducers: gear, aspects, professions, identity, notes, race effects, attunements.
// Pure (INV-PURE): each takes a Character and an action and returns a new Character, or throws RuleError.
// Records an action creates get the id `<action.id>:<n>` (ruling 6); all of these create at most one, so `:0`.
import { RuleError } from '../types'
import type { Action, Armor, Aspect, Character, Coins, GearItem, Profession, Shield, Weapon } from '../types'

const COLLECTION_KINDS = [
  'gear:weapon:add', 'gear:weapon:edit', 'gear:weapon:remove', 'gear:wield',
  'gear:armor:set', 'gear:shield:set', 'gear:wear',
  'gear:item:add', 'gear:item:edit', 'gear:item:remove', 'gear:coins:set',
  'aspect:edit', 'aspect:remove',
  'profession:add', 'profession:edit', 'profession:remove',
  'identity:set', 'notes:set', 'raceEffects:set', 'attunement:set',
] as const

const IDENTITY_FIELDS = ['name', 'pronouns', 'dream', 'description', 'motivation', 'portrait'] as const

export type CollectionAction = Extract<Action, { kind: (typeof COLLECTION_KINDS)[number] }>

export function isCollectionAction(a: Action): a is CollectionAction {
  return (COLLECTION_KINDS as readonly string[]).includes(a.kind)
}

// ---- helpers ------------------------------------------------------------------------------------

const created = (a: Action) => `${a.id}:0`

function count(what: string, v: number | undefined, { min = 0, max = Infinity, integer = true } = {}) {
  if (v === undefined) return
  if (!Number.isFinite(v) || (integer && !Number.isInteger(v)) || v < min || v > max) {
    throw new RuleError('invalid_amount', `${what} must be ${integer ? 'an integer' : 'a number'} from ${min}${max === Infinity ? ' up' : ` to ${max}`}, got ${v}`)
  }
}

function index<T extends { id: string }>(list: readonly T[], id: string, what: string): number {
  const i = list.findIndex(x => x.id === id)
  if (i < 0) throw new RuleError('not_found', `no ${what} ${id}`)
  return i
}

const replaceAt = <T>(list: readonly T[], i: number, item: T): T[] => list.map((x, j) => (j === i ? item : x))
const without = <T>(list: readonly T[], i: number): T[] => list.filter((_, j) => j !== i)

/** Rulebook (Equipment & Gear): one weapon wielded at a time. Wielding `id` unwields the rest; `null` unwields all. */
const wieldOnly = (weapons: readonly Weapon[], id: string | null): Weapon[] =>
  weapons.map(w => (w.wielded === (w.id === id) ? w : { ...w, wielded: w.id === id }))

const withGear = (c: Character, gear: Partial<Character['gear']>): Character => ({ ...c, gear: { ...c.gear, ...gear } })

// ---- reducer ------------------------------------------------------------------------------------

export function reduceCollections(c: Character, a: CollectionAction): Character {
  switch (a.kind) {
    case 'gear:weapon:add': {
      count('weapon misc', a.weapon.misc, { min: -Infinity })
      const w: Weapon = { ...a.weapon, id: created(a) }
      return withGear(c, { weapons: [...(w.wielded ? wieldOnly(c.gear.weapons, null) : c.gear.weapons), w] })
    }
    case 'gear:weapon:edit': {
      const i = index(c.gear.weapons, a.weapon.id, 'weapon')
      count('weapon misc', a.weapon.misc, { min: -Infinity })
      const w: Weapon = { ...c.gear.weapons[i]!, ...a.weapon, id: a.weapon.id }
      const weapons = replaceAt(c.gear.weapons, i, w)
      return withGear(c, { weapons: w.wielded ? wieldOnly(weapons, w.id) : weapons })
    }
    case 'gear:weapon:remove':
      return withGear(c, { weapons: without(c.gear.weapons, index(c.gear.weapons, a.weaponId, 'weapon')) })
    case 'gear:wield':
      if (a.weaponId !== null) index(c.gear.weapons, a.weaponId, 'weapon')
      return withGear(c, { weapons: wieldOnly(c.gear.weapons, a.weaponId) })

    case 'gear:armor:set': {
      count('armor misc', a.armor.misc, { min: -Infinity })
      const armor: Armor = { ...c.gear.armor, ...a.armor }
      return withGear(c, { armor })
    }
    case 'gear:shield:set': {
      count('shield misc', a.shield.misc, { min: -Infinity })
      const shield: Shield = { ...c.gear.shield, ...a.shield }
      return withGear(c, { shield })
    }
    case 'gear:wear':
      return withGear(c, { [a.piece]: { ...c.gear[a.piece], worn: a.worn } })

    case 'gear:item:add': {
      count('item slots', a.item.slots, { integer: false })
      count('item quantity', a.item.quantity)
      const item: GearItem = { ...a.item, id: created(a) }
      return withGear(c, { items: [...c.gear.items, item] })
    }
    case 'gear:item:edit': {
      const i = index(c.gear.items, a.item.id, 'item')
      count('item slots', a.item.slots, { integer: false })
      count('item quantity', a.item.quantity)
      return withGear(c, { items: replaceAt(c.gear.items, i, { ...c.gear.items[i]!, ...a.item, id: a.item.id }) })
    }
    case 'gear:item:remove':
      return withGear(c, { items: without(c.gear.items, index(c.gear.items, a.itemId, 'item')) })
    case 'gear:coins:set': {
      for (const [k, v] of Object.entries(a.coins)) count(`${k} coins`, v)
      const coins: Coins = { ...c.gear.coins, ...a.coins }
      return withGear(c, { coins })
    }

    // New aspects and ranks come only through `xp:buy`, so an edit takes text and honor and nothing else.
    case 'aspect:edit': {
      const i = index(c.aspects, a.aspect.id, 'aspect')
      const old = c.aspects[i]!
      const next: Aspect = { ...old, text: a.aspect.text ?? old.text, honor: a.aspect.honor ?? old.honor }
      return { ...c, aspects: replaceAt(c.aspects, i, next) }
    }
    case 'aspect:remove':
      return { ...c, aspects: without(c.aspects, index(c.aspects, a.aspectId, 'aspect')) }

    case 'profession:add': {
      const p = a.profession
      count('profession rank', p.rank, { max: 7 })
      count('challenges', p.challenges)
      count('missions', p.missions)
      count('practice weeks', p.practiceWeeks)
      const profession: Profession = { rank: 0, challenges: 0, missions: 0, practiceWeeks: 0, rerollOnes: false, ...p, id: created(a) }
      return { ...c, professions: [...c.professions, profession] }
    }
    case 'profession:edit': {
      const i = index(c.professions, a.profession.id, 'profession')
      const p = a.profession
      count('profession rank', p.rank, { max: 7 })
      count('challenges', p.challenges)
      count('missions', p.missions)
      count('practice weeks', p.practiceWeeks)
      return { ...c, professions: replaceAt(c.professions, i, { ...c.professions[i]!, ...p, id: p.id }) }
    }
    case 'profession:remove':
      return { ...c, professions: without(c.professions, index(c.professions, a.professionId, 'profession')) }

    case 'identity:set': {
      // Descriptive fields only: age category and benefits are fixed once the builder finishes.
      const next = { ...c.identity }
      for (const k of IDENTITY_FIELDS) if (a.identity[k] !== undefined) next[k] = a.identity[k] as never
      return { ...c, identity: next }
    }
    case 'notes:set':
      return { ...c, notes: a.notes }
    case 'raceEffects:set':
      return { ...c, raceEffects: a.effects }
    case 'attunement:set':
      return { ...c, attunements: a.attunements }
  }
}
