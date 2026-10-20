// The dispatcher over every reducer: applyAction, the restore inverse (ruling 7), the undo stack rule and
// stored-state upgrades. Pure and deterministic (INV-PURE, INV-DET): no Date, no randomness, no I/O.
// `restore` and `undo` are produced here and by the server, never accepted from a client (INV-INTERNAL).
import type { ConditionCatalogue } from './catalogue'
import { isProfessionProgressAction, reduceProfessionProgress } from './professions'
import { isCollectionAction, reduceCollections } from './reducers/collections'
import * as combat from './reducers/combat'
import * as xp from './reducers/xp'
import { RuleError, SCHEMA_VERSION } from './types'
import type { Action, Character, ClientAction, Inverse, StoredState } from './types'

/** What the dispatcher needs from the catalogue: only `nextRound` reads it (which conditions fade). */
export type ActionCatalogue = { conditions: ConditionCatalogue }

/** Every top-level key a restore may carry. `schemaVersion` and `draft` are never changed by an action. */
const RESTORABLE: ReadonlySet<string> = new Set<keyof Character>([
  'identity', 'kin', 'attunements', 'path', 'bloodmarks', 'abilities', 'hp', 'wounds', 'conditions', 'aspects', 'professions',
  'talents', 'gear', 'xp', 'play', 'raceEffects', 'notes',
])

function reduce(c: Character, a: ClientAction, catalogue: ActionCatalogue): Character {
  if (isCollectionAction(a)) return reduceCollections(c, a)
  if (isProfessionProgressAction(a)) return reduceProfessionProgress(c, a)
  switch (a.kind) {
    case 'damage': return combat.damage(c, a)
    case 'heal': return combat.heal(c, a)
    case 'setHp': return combat.setHp(c, a)
    case 'wound:add': return combat.woundAdd(c, a)
    case 'wound:edit': return combat.woundEdit(c, a)
    case 'wound:remove': return combat.woundRemove(c, a)
    case 'wound:treat': return combat.woundTreat(c, a)
    case 'condition:set': return combat.conditionSet(c, a)
    case 'condition:custom': return combat.conditionCustom(c, a)
    case 'ability:use': return combat.abilityUse(c, a)
    // The combat reducers type these three by the literal kind, so the shared-union action is re-tagged.
    case 'rush:set': return combat.rushSet(c, { ...a, kind: 'rush:set' })
    case 'dp:set': return combat.dpSet(c, { ...a, kind: 'dp:set' })
    case 'round:set': return combat.roundSet(c, { ...a, kind: 'round:set' })
    case 'heartDie:spend': return combat.heartDieSpend(c, a)
    case 'heartDie:set': return combat.heartDieSet(c, a)
    case 'nextRound': return combat.nextRound(c, a, catalogue.conditions)
    case 'endFight': return combat.endFight(c, a)
    case 'shortRest': return combat.shortRest(c, a)
    case 'longRest': return combat.longRest(c, a)
    case 'startSession': return combat.startSession(c, a)
    case 'xp:award': return xp.xpAward(c, a)
    case 'xp:buy': return xp.xpBuy(c, a)
    case 'bloodmark:award': return xp.bloodmarkAward(c, a)
    case 'bloodmark:pick': return xp.bloodmarkPick(c, a)
    default: throw new RuleError('bad_action', `Unknown action kind: ${String((a as { kind: unknown }).kind)}`)
  }
}

/** Structural equality for stored JSON values. */
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every(k => Object.hasOwn(b, k) && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/** The previous value of every top-level key where `after` differs from `before`. */
function inverseOf(before: Character, after: Character): Inverse {
  const slices: Partial<Character> = {}
  for (const key of Object.keys(before) as Array<keyof Character>) {
    if (!same(before[key], after[key])) (slices as Record<string, unknown>)[key] = before[key]
  }
  return { kind: 'restore', slices }
}

/**
 * Applies one client action. Throws `RuleError` when the rules refuse it (`bad_action` for `restore`, `undo`
 * and unknown kinds); the input character is never changed.
 */
export function applyAction(c: Character, a: ClientAction, catalogue: ActionCatalogue): { character: Character; inverse: Inverse } {
  const kind: unknown = (a as { kind?: unknown } | null)?.kind
  if (kind === 'restore' || kind === 'undo') throw new RuleError('bad_action', `${kind} is not a client action`)
  if (typeof a?.id !== 'string' || !a.id || typeof a.at !== 'string' || !a.at) throw new RuleError('bad_action', 'An action needs an id and an at')
  const character = reduce(c, a, catalogue)
  return { character, inverse: inverseOf(c, character) }
}

/**
 * Applies a stored inverse (the `inverse` column of an event) and returns the new character with the inverse
 * of that restore, which the server stores on the undo event.
 */
export function applyInverse(c: Character, inverse: Inverse): { character: Character; inverse: Inverse } {
  if (inverse?.kind !== 'restore' || typeof inverse.slices !== 'object' || inverse.slices === null) throw new RuleError('bad_action', 'Not a stored inverse')
  const keys = Object.keys(inverse.slices)
  const unknown = keys.find(k => !RESTORABLE.has(k))
  if (unknown !== undefined) throw new RuleError('bad_action', `Cannot restore ${unknown}`)
  const character: Character = { ...c, ...inverse.slices }
  return { character, inverse: inverseOf(c, character) }
}

/** The part of a `character_event` row the undo rule reads. */
export type UndoableEvent = { id: string; seq: number; kind: Action['kind']; undone: boolean }

/**
 * Interfaces #2 and D16: only the newest event that is not undone, and is not itself an undo, can be undone.
 * Returns that event. With `eventId`, that event must be it: an unknown id is `not_found`, any other event
 * (older, already undone, or an undo) is `not_top_of_stack`. Without `eventId`, an empty stack is `not_top_of_stack`.
 */
export function canUndo(events: readonly UndoableEvent[], eventId?: string): UndoableEvent {
  if (eventId !== undefined && !events.some(e => e.id === eventId)) throw new RuleError('not_found', `No event ${eventId}`)
  let top: UndoableEvent | undefined
  for (const e of events) if (!e.undone && e.kind !== 'undo' && (!top || e.seq > top.seq)) top = e
  if (!top || (eventId !== undefined && top.id !== eventId)) throw new RuleError('not_top_of_stack')
  return top
}

/** Brings a stored document to the current schema. Version 1 is the current one, so this is the identity. */
export function upgradeCharacter(state: unknown): StoredState {
  const version = (state as { schemaVersion?: unknown } | null)?.schemaVersion
  if (version !== SCHEMA_VERSION) throw new RuleError('bad_action', `Unsupported schemaVersion: ${String(version)}`)
  return state as StoredState
}
