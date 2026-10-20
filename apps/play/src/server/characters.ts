// The character store: every read and write of `character` / `character_event` (INV-ACTION).
//
// Ruling 22: each operation is a plain `(db, userId, input) → result` function holding all the logic, and the
// tests call those. The `createServerFn` wrappers at the bottom resolve the signed-in user and pass `env.DB`.
//
// Results never throw for an expected refusal: `{ok: false, status, code, message}`. A revision conflict is the
// refusal `code: 'conflict'` and carries the current document in `character`. Infrastructure failures throw.
import { createServerFn } from '@tanstack/react-start'
import { applyAction, applyInverse, canUndo, upgradeCharacter, type UndoableEvent } from '@heartrush/rules-engine/actions'
import type { ConditionCatalogue } from '@heartrush/rules-engine/catalogue'
import { bloodmarkPicksOwed } from '@heartrush/rules-engine/bloodmarks'
import { createCharacter } from '@heartrush/rules-engine/create'
import {
  defenseBonus, deathThreshold, disadvantage, effectiveMaxHp, maxHeartDie, maxHp, situational, slotCapacity, slotsUsed, speed,
  weaponDice, woundPenalty, type SituationalLine,
} from '@heartrush/rules-engine/derived'
import { previewDraft } from '@heartrush/rules-engine/draft'
import { xpByKind, xpRemaining, xpSpent } from '@heartrush/rules-engine/pricing'
import {
  RuleError, SCHEMA_VERSION,
  type AbilityId, type Action, type BloodmarkKind, type BuilderInput, type Character, type ClientAction, type DraftState, type Inverse,
  type PurchaseKind, type RuleErrorCode, type StoredState,
} from '@heartrush/rules-engine/types'
import { ulid } from 'ulid'
import { getCatalogue } from '../catalogue'
import { characterRole, mayWrite, type CharacterRole } from './authz'
import { publishCharacterWrite } from './live'

// ---- Types -------------------------------------------------------------------------------------

export type CharacterErrorCode =
  | 'forbidden' | 'not_found' | 'bad_input' | 'bad_action'
  | 'conflict' | 'duplicate_action' | 'duplicate_id' | 'not_a_draft' | 'is_draft' | 'not_top_of_stack'
  | 'draft_invalid'

/** One pending draft action the rules refuse, or (`actionId` null) the builder itself. */
export type InvalidDraftEntry = { actionId: string | null; code: RuleErrorCode; message: string }

/** An expected refusal. `conflict` carries the current document; `draft_invalid` lists what is refused. */
export type Refusal = {
  ok: false
  status: number
  code: CharacterErrorCode | RuleErrorCode
  message: string
  character?: CharacterDoc
  invalid?: InvalidDraftEntry[]
}

/** Derived values for a finished character (INV-DERIVED: computed on read, never stored). */
export type Derived = {
  maxHp: number
  effectiveMaxHp: number
  woundPenalty: number
  deathThreshold: number
  speed: number
  defenseBonus: number
  maxHeartDie: 8 | 10 | 12 | 20
  slotCapacity: number
  slotsUsed: number
  weaponDice: Record<'might' | 'agility' | 'cunning', string | null>
  disadvantage: Record<AbilityId, number>
  situational: SituationalLine[]
  xp: { awarded: number; spent: number; remaining: number; byKind: Partial<Record<PurchaseKind, number>> }
  bloodmarkPicksOwed: Record<BloodmarkKind, number>
}

/** The stored document as every read returns it. `derived` is null for a draft; `role` is the viewer's. */
export type CharacterDoc = {
  id: string
  ownerUserId: string
  campaignId: string | null
  name: string
  revision: number
  updatedAt: string
  state: StoredState
  derived: Derived | null
  role: CharacterRole
}

export type Ok = { ok: true; character: CharacterDoc }
export type CharacterResult = Ok | Refusal

export type CharacterSummary = {
  id: string
  name: string
  draft: boolean
  campaignId: string | null
  revision: number
  updatedAt: string
  /** The race as written on the finished character; null for a draft (its race is `builder.raceId`). */
  raceTitle: string | null
  /** Current HP and effective max HP (derived on read); null for a draft. */
  hp: { current: number; effectiveMax: number } | null
  /** The campaign's name; null when the character is in no campaign. */
  campaignName: string | null
}

export type EventSummary = {
  id: string
  seq: number
  kind: Action['kind']
  action: Action
  undone: boolean
  actorUserId: string
  createdAt: string
}

export type ListCharactersResult = { ok: true; characters: CharacterSummary[] }
export type ListEventsResult = { ok: true; events: EventSummary[]; topEventId: string | null } | Refusal

export type CreateDraftInput = { builder: BuilderInput }
export type SaveDraftInput = { characterId: string; revision: number; builder: BuilderInput; pending: ClientAction[] }
export type FinishDraftInput = { characterId: string; revision: number }
export type ApplyInput = { characterId: string; revision: number; action: ClientAction }
export type UndoInput = { characterId: string; eventId: string }
export type CharacterRef = { characterId: string }

// ---- Helpers -----------------------------------------------------------------------------------

const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

const STATUS: Record<CharacterErrorCode, number> = {
  forbidden: 403, not_found: 404, bad_input: 400, bad_action: 400,
  conflict: 409, duplicate_action: 409, duplicate_id: 409, not_a_draft: 409, is_draft: 409, not_top_of_stack: 409,
  draft_invalid: 422,
}

function refuse(code: CharacterErrorCode, message: string, extra: Partial<Refusal> = {}): Refusal {
  return { ok: false, status: STATUS[code], code, message, ...extra }
}

function ruleRefusal(e: RuleError): Refusal {
  if (e.code === 'bad_action' || e.code === 'not_top_of_stack' || e.code === 'not_found') return refuse(e.code, e.message)
  return { ok: false, status: 422, code: e.code, message: e.message }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** INV-DET: an id is a ULID and a time is ISO, both stamped by the client. */
function badStamp(v: unknown, what: string): Refusal | null {
  if (!isRecord(v)) return refuse('bad_action', `${what} must be an object`)
  if (typeof v.id !== 'string' || !ULID.test(v.id)) return refuse('bad_action', `${what} needs an id that is a ULID`)
  if (typeof v.at !== 'string' || !ISO_TIME.test(v.at) || Number.isNaN(Date.parse(v.at))) return refuse('bad_action', `${what} needs an at that is an ISO time`)
  return null
}

/** INV-INTERNAL + INV-DET: what a client may send as an action. */
function badClientAction(a: unknown): Refusal | null {
  if (!isRecord(a) || typeof a.kind !== 'string') return refuse('bad_action', 'An action needs a kind')
  if (a.kind === 'restore' || a.kind === 'undo') return refuse('bad_action', `${a.kind} is not a client action`)
  return badStamp(a, 'An action')
}

const badRevision = (revision: unknown): Refusal | null =>
  Number.isSafeInteger(revision) && (revision as number) >= 1 ? null : refuse('bad_input', 'revision must be a positive integer')

const badId = (id: unknown, what: string): Refusal | null =>
  typeof id === 'string' && id ? null : refuse('bad_input', `${what} must be a non-empty string`)

type Row = { id: string; owner_user_id: string; campaign_id: string | null; name: string; state: string; revision: number; updated_at: string }
const ROW = 'SELECT id, owner_user_id, campaign_id, name, state, revision, updated_at FROM character WHERE id = ?'

export function deriveCharacter(c: Character, catalogue: { conditions: ConditionCatalogue }): Derived {
  return {
    maxHp: maxHp(c),
    effectiveMaxHp: effectiveMaxHp(c),
    woundPenalty: woundPenalty(c),
    deathThreshold: deathThreshold(c),
    speed: speed(c),
    defenseBonus: defenseBonus(c),
    maxHeartDie: maxHeartDie(c),
    slotCapacity: slotCapacity(c),
    slotsUsed: slotsUsed(c),
    weaponDice: { might: weaponDice(c, 'might'), agility: weaponDice(c, 'agility'), cunning: weaponDice(c, 'cunning') },
    disadvantage: {
      might: disadvantage(c, 'might', catalogue.conditions),
      agility: disadvantage(c, 'agility', catalogue.conditions),
      cunning: disadvantage(c, 'cunning', catalogue.conditions),
      presence: disadvantage(c, 'presence', catalogue.conditions),
    },
    situational: situational(c, catalogue.conditions),
    xp: { awarded: c.xp.awarded, spent: xpSpent(c), remaining: xpRemaining(c), byKind: xpByKind(c) },
    bloodmarkPicksOwed: bloodmarkPicksOwed(c),
  }
}

const stateOf = (row: Row): StoredState => upgradeCharacter(JSON.parse(row.state))

function toDoc(row: Row, role: CharacterRole): CharacterDoc {
  const state = stateOf(row)
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    campaignId: row.campaign_id,
    name: row.name,
    revision: row.revision,
    updatedAt: row.updated_at,
    state,
    derived: state.draft ? null : deriveCharacter(state, getCatalogue()),
    role,
  }
}

/** The row, if the user may read it (`need: 'read'`) or write it (`need: 'write'`). A draft is its owner's alone. */
async function loadFor(db: D1Database, userId: string, characterId: string, need: 'read' | 'write'): Promise<{ row: Row; role: CharacterRole } | Refusal> {
  const row = await db.prepare(ROW).bind(characterId).first<Row>()
  if (!row) return refuse('not_found', 'No such character')
  const role = await characterRole(db, userId, { ownerUserId: row.owner_user_id, campaignId: row.campaign_id, draft: stateOf(row).draft })
  if (!role || (need === 'write' && !mayWrite(role))) return refuse('forbidden', need === 'write' ? 'You cannot edit this character' : 'You cannot see this character')
  return { row, role }
}

const isRefusal = (v: object): v is Refusal => 'ok' in v && (v as { ok: unknown }).ok === false

/** The current document as a `conflict` refusal: the caller reapplies its one in-flight action on top. */
async function conflict(db: D1Database, userId: string, characterId: string): Promise<Refusal> {
  const current = await loadFor(db, userId, characterId, 'read')
  if (isRefusal(current)) return current
  return refuse('conflict', 'The character changed; reapply on the current document', { character: toDoc(current.row, current.role) })
}

const UPDATE_LIVE = 'UPDATE character SET state = ?, name = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?'
const INSERT_EVENT =
  'INSERT INTO character_event (id, character_id, actor_user_id, seq, action, inverse, undone, created_at) SELECT ?, ?, ?, ?, ?, ?, 0, ? WHERE changes() = 1'
/** Each statement after the first must run only if the previous one changed a row. */
const CHAINED_UNDO_MARK = 'UPDATE character_event SET undone = 1 WHERE id = ? AND undone = 0 AND changes() = 1'

type BatchOutcome = 'committed' | 'conflict' | 'duplicate_action'

/**
 * Runs a conditional batch. The first statement is the revision-checked UPDATE; every later one is chained on
 * `changes() = 1`, so a stale writer inserts nothing. A thrown statement rolls the whole batch back; if an event id
 * in `eventIds` already exists, that is the primary key refusing a reused action id.
 */
async function runBatch(db: D1Database, statements: D1PreparedStatement[], eventIds: string[]): Promise<BatchOutcome> {
  let results: D1Result[]
  try {
    results = await db.batch(statements)
  } catch (error) {
    if (eventIds.length === 0) throw error
    const marks = eventIds.map(() => '?').join(', ')
    const reused = await db.prepare(`SELECT 1 AS found FROM character_event WHERE id IN (${marks})`).bind(...eventIds).first()
    if (reused) return 'duplicate_action'
    throw error
  }
  if (results[0].meta.changes === 0) return 'conflict'
  results.forEach((r, i) => {
    if (i > 0 && r.meta.changes !== 1) throw new Error(`Character batch statement ${i} changed ${r.meta.changes} rows after the revision check passed`)
  })
  return 'committed'
}

function eventStatements(db: D1Database, row: Row, userId: string, event: { id: string; action: Action; inverse: Inverse }, now: string) {
  return db.prepare(INSERT_EVENT).bind(event.id, row.id, userId, row.revision + 1, JSON.stringify(event.action), JSON.stringify(event.inverse), now)
}

/** The document just committed, built from what was written (no re-read). */
function committedDoc(row: Row, role: CharacterRole, state: StoredState, name: string, now: string, revision: number): CharacterDoc {
  return toDoc({ ...row, state: JSON.stringify(state), name, revision, updated_at: now }, role)
}

// ---- Queries -----------------------------------------------------------------------------------

/** The user's own characters, drafts flagged. */
export async function listCharacters(db: D1Database, userId: string): Promise<ListCharactersResult> {
  const { results } = await db
    .prepare(
      `SELECT ch.id, ch.name, ch.campaign_id, ch.revision, ch.updated_at, ch.state, c.name AS campaign_name
         FROM character ch LEFT JOIN campaign c ON c.id = ch.campaign_id
        WHERE ch.owner_user_id = ? ORDER BY ch.updated_at DESC, ch.id DESC`,
    )
    .bind(userId)
    .all<{ id: string; name: string; campaign_id: string | null; revision: number; updated_at: string; state: string; campaign_name: string | null }>()
  return {
    ok: true,
    characters: results.map((r) => {
      const state = upgradeCharacter(JSON.parse(r.state))
      return {
        id: r.id, name: r.name, draft: state.draft, campaignId: r.campaign_id, revision: r.revision, updatedAt: r.updated_at,
        raceTitle: state.draft ? null : state.kin.titleSnapshot,
        hp: state.draft ? null : { current: state.hp.current, effectiveMax: effectiveMaxHp(state) },
        campaignName: r.campaign_name,
      }
    }),
  }
}

export async function getCharacter(db: D1Database, userId: string, input: CharacterRef): Promise<CharacterResult> {
  const bad = badId(input?.characterId, 'characterId')
  if (bad) return bad
  const loaded = await loadFor(db, userId, input.characterId, 'read')
  if (isRefusal(loaded)) return loaded
  return { ok: true, character: toDoc(loaded.row, loaded.role) }
}

const EVENT_LIMIT = 20

/** The last 20 events (newest first) and the id of the one event Undo is offered on (null when there is none). */
export async function listEvents(db: D1Database, userId: string, input: CharacterRef): Promise<ListEventsResult> {
  const bad = badId(input?.characterId, 'characterId')
  if (bad) return bad
  const loaded = await loadFor(db, userId, input.characterId, 'read')
  if (isRefusal(loaded)) return loaded
  const { results: recent } = await db
    .prepare('SELECT id, seq, action, undone, actor_user_id, created_at FROM character_event WHERE character_id = ? ORDER BY seq DESC LIMIT ?')
    .bind(input.characterId, EVENT_LIMIT)
    .all<{ id: string; seq: number; action: string; undone: number; actor_user_id: string; created_at: string }>()
  let topEventId: string | null = null
  try {
    topEventId = canUndo(await undoableEvents(db, input.characterId)).id
  } catch (error) {
    if (!(error instanceof RuleError && error.code === 'not_top_of_stack')) throw error
  }
  return {
    ok: true,
    topEventId,
    events: recent.map((r) => {
      const action = JSON.parse(r.action) as Action
      return { id: r.id, seq: r.seq, kind: action.kind, action, undone: r.undone === 1, actorUserId: r.actor_user_id, createdAt: r.created_at }
    }),
  }
}

async function undoableEvents(db: D1Database, characterId: string): Promise<UndoableEvent[]> {
  const { results } = await db
    .prepare("SELECT id, seq, json_extract(action, '$.kind') AS kind, undone FROM character_event WHERE character_id = ?")
    .bind(characterId)
    .all<{ id: string; seq: number; kind: Action['kind']; undone: number }>()
  return results.map((r) => ({ id: r.id, seq: r.seq, kind: r.kind, undone: r.undone === 1 }))
}

// ---- Drafts (ruling 8) --------------------------------------------------------------------------

const draftName = (builder: BuilderInput): string => (typeof builder.name === 'string' ? builder.name : '')

function badBuilder(builder: unknown): Refusal | null {
  const stamp = badStamp(builder, 'The builder')
  if (stamp) return refuse('bad_input', stamp.message.replace('An action', 'The builder'))
  return null
}

function badPending(pending: unknown): Refusal | null {
  if (!Array.isArray(pending)) return refuse('bad_input', 'pending must be a list of actions')
  const seen = new Set<string>()
  for (const a of pending) {
    const bad = badClientAction(a)
    if (bad) return bad
    if (seen.has(a.id)) return refuse('duplicate_action', `Action id ${a.id} appears twice`)
    seen.add(a.id)
  }
  return null
}

/** Creates the draft row. The character's id is the builder's id (INV-DET), so the ids it later derives line up. */
export async function createDraft(db: D1Database, userId: string, input: CreateDraftInput): Promise<CharacterResult> {
  const bad = badBuilder(input?.builder)
  if (bad) return bad
  const { builder } = input
  const state: DraftState = { schemaVersion: SCHEMA_VERSION, draft: true, builder, pending: [] }
  const now = new Date().toISOString()
  try {
    await db
      .prepare('INSERT INTO character (id, owner_user_id, campaign_id, name, state, revision, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, 1, ?, ?)')
      .bind(builder.id, userId, draftName(builder), JSON.stringify(state), now, now)
      .run()
  } catch (error) {
    if (await db.prepare('SELECT 1 AS found FROM character WHERE id = ?').bind(builder.id).first()) return refuse('duplicate_id', 'A character with this id exists')
    throw error
  }
  const row: Row = { id: builder.id, owner_user_id: userId, campaign_id: null, name: draftName(builder), state: JSON.stringify(state), revision: 1, updated_at: now }
  return { ok: true, character: toDoc(row, 'owner') }
}

/** Writes steps 1–5 and the pending step 6–7 actions with a revision check and no event. */
export async function saveDraft(db: D1Database, userId: string, input: SaveDraftInput): Promise<CharacterResult> {
  const bad = badId(input?.characterId, 'characterId') ?? badRevision(input?.revision) ?? badBuilder(input?.builder) ?? badPending(input?.pending)
  if (bad) return bad
  if (input.builder.id !== input.characterId) return refuse('bad_input', 'The builder id must be the character id')
  const loaded = await loadFor(db, userId, input.characterId, 'write')
  if (isRefusal(loaded)) return loaded
  const { row, role } = loaded
  if (!stateOf(row).draft) return refuse('not_a_draft', 'This character is finished')
  if (row.revision !== input.revision) return conflict(db, userId, row.id)
  const state: DraftState = { schemaVersion: SCHEMA_VERSION, draft: true, builder: input.builder, pending: input.pending }
  const now = new Date().toISOString()
  const result = await db
    .prepare(`${UPDATE_LIVE} AND json_extract(state, '$.draft') = 1`)
    .bind(JSON.stringify(state), draftName(input.builder), now, row.id, input.revision)
    .run()
  if (result.meta.changes === 0) return conflict(db, userId, row.id)
  return { ok: true, character: committedDoc(row, role, state, draftName(input.builder), now, row.revision + 1) }
}

/**
 * Ruling 8. Runs `previewDraft` on the server; if the builder or any pending action is refused, writes nothing and
 * answers `draft_invalid` naming them. Otherwise one batch writes the finished Character at revision 1 + n and the n
 * pending actions as events at seq 2 … n+1, each chained on the one before.
 */
export async function finishDraft(db: D1Database, userId: string, input: FinishDraftInput): Promise<CharacterResult> {
  const bad = badId(input?.characterId, 'characterId') ?? badRevision(input?.revision)
  if (bad) return bad
  const loaded = await loadFor(db, userId, input.characterId, 'write')
  if (isRefusal(loaded)) return loaded
  const { row, role } = loaded
  const draft = stateOf(row)
  if (!draft.draft) return refuse('not_a_draft', 'This character is finished')
  if (row.revision !== input.revision) return conflict(db, userId, row.id)

  const catalogue = getCatalogue()
  let preview: ReturnType<typeof previewDraft>
  try {
    preview = previewDraft(draft, catalogue)
  } catch (error) {
    if (!(error instanceof RuleError)) throw error
    return refuse('draft_invalid', `The builder is invalid: ${error.message}`, { invalid: [{ actionId: null, code: error.code, message: error.message }] })
  }
  if (preview.invalid.length > 0) {
    const names = preview.invalid.map((i) => `${i.actionId} (${i.error.code})`).join(', ')
    return refuse('draft_invalid', `These pending actions are refused: ${names}`, {
      invalid: preview.invalid.map((i) => ({ actionId: i.actionId, code: i.error.code, message: i.error.message })),
    })
  }

  // previewDraft returns the end state only; replay for each action's inverse. None can throw: preview just applied them.
  let character = createCharacter(draft.builder, catalogue)
  const events = draft.pending.map((action) => {
    const applied = applyAction(character, action, catalogue)
    character = applied.character
    return { id: action.id, action: action as Action, inverse: applied.inverse }
  })

  const now = new Date().toISOString()
  const finalRevision = 1 + events.length
  const statements = [
    db
      .prepare(`UPDATE character SET state = ?, name = ?, revision = ?, updated_at = ? WHERE id = ? AND revision = ? AND json_extract(state, '$.draft') = 1`)
      .bind(JSON.stringify(character), character.identity.name, finalRevision, now, row.id, input.revision),
    ...events.map((event, i) =>
      db.prepare(INSERT_EVENT).bind(event.id, row.id, userId, i + 2, JSON.stringify(event.action), JSON.stringify(event.inverse), now),
    ),
  ]
  const outcome = await runBatch(db, statements, events.map((e) => e.id))
  if (outcome === 'conflict') return conflict(db, userId, row.id)
  if (outcome === 'duplicate_action') return refuse('duplicate_action', 'A pending action id was already used')
  return { ok: true, character: committedDoc(row, role, character, character.identity.name, now, finalRevision) }
}

// ---- Actions and undo (Interfaces #1, #2) ----------------------------------------------------------

/** Applies one client action: revision-checked UPDATE, then the event INSERT chained on `changes() = 1`. */
export async function applyCharacterAction(db: D1Database, userId: string, input: ApplyInput): Promise<CharacterResult> {
  const bad = badId(input?.characterId, 'characterId') ?? badRevision(input?.revision) ?? badClientAction(input?.action)
  if (bad) return bad
  const loaded = await loadFor(db, userId, input.characterId, 'write')
  if (isRefusal(loaded)) return loaded
  const { row, role } = loaded
  const current = stateOf(row)
  if (current.draft) return refuse('is_draft', 'A draft is edited through saveDraft')
  if (row.revision !== input.revision) return conflict(db, userId, row.id)

  let applied: ReturnType<typeof applyAction>
  try {
    applied = applyAction(current, input.action, getCatalogue())
  } catch (error) {
    if (error instanceof RuleError) return ruleRefusal(error)
    throw error
  }
  const now = new Date().toISOString()
  const statements = [
    db.prepare(UPDATE_LIVE).bind(JSON.stringify(applied.character), applied.character.identity.name, now, row.id, row.revision),
    eventStatements(db, row, userId, { id: input.action.id, action: input.action, inverse: applied.inverse }, now),
  ]
  const outcome = await runBatch(db, statements, [input.action.id])
  if (outcome === 'conflict') return conflict(db, userId, row.id)
  if (outcome === 'duplicate_action') return refuse('duplicate_action', `Action id ${input.action.id} was already used`)
  return { ok: true, character: committedDoc(row, role, applied.character, applied.character.identity.name, now, row.revision + 1) }
}

/**
 * Undoes the top event: applies its stored inverse as a new `undo` event (id generated here) and marks the original
 * undone, in one batch. Only the newest event that is not undone and not itself an undo is accepted.
 */
export async function undoCharacterEvent(db: D1Database, userId: string, input: UndoInput): Promise<CharacterResult> {
  const bad = badId(input?.characterId, 'characterId') ?? badId(input?.eventId, 'eventId')
  if (bad) return bad
  const loaded = await loadFor(db, userId, input.characterId, 'write')
  if (isRefusal(loaded)) return loaded
  const { row, role } = loaded
  const current = stateOf(row)
  if (current.draft) return refuse('is_draft', 'A draft has no events')

  let stored: Inverse
  let undone: ReturnType<typeof applyInverse>
  try {
    canUndo(await undoableEvents(db, row.id), input.eventId)
    const event = await db.prepare('SELECT inverse FROM character_event WHERE id = ? AND character_id = ?').bind(input.eventId, row.id).first<{ inverse: string }>()
    stored = JSON.parse(event!.inverse) as Inverse
    undone = applyInverse(current, stored)
  } catch (error) {
    if (error instanceof RuleError) return ruleRefusal(error)
    throw error
  }
  const now = new Date().toISOString()
  const action: Action = { kind: 'undo', of: input.eventId, id: ulid(), at: now }
  const statements = [
    db.prepare(UPDATE_LIVE).bind(JSON.stringify(undone.character), undone.character.identity.name, now, row.id, row.revision),
    eventStatements(db, row, userId, { id: action.id, action, inverse: undone.inverse }, now),
    db.prepare(CHAINED_UNDO_MARK).bind(input.eventId),
  ]
  const outcome = await runBatch(db, statements, [action.id])
  if (outcome === 'conflict') return conflict(db, userId, row.id)
  if (outcome === 'duplicate_action') throw new Error('A freshly generated undo event id already exists')
  return { ok: true, character: committedDoc(row, role, undone.character, undone.character.identity.name, now, row.revision + 1) }
}

// ---- Server functions (ruling 22) -----------------------------------------------------------------
// Thin wrappers: resolve the signed-in user (INV-AUTHZ) and pass `env.DB`. The imports are dynamic so the plain
// functions above load under node for the tests, where `cloudflare:workers` does not exist.

async function context() {
  const [{ requireUser }, { env }] = await Promise.all([import('./session'), import('cloudflare:workers')])
  const { userId } = await requireUser()
  return { env, db: env.DB, userId }
}

const input = <T>() => (data: unknown) => data as T

export const listCharactersFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { db, userId } = await context()
  return listCharacters(db, userId)
})

export const getCharacterFn = createServerFn({ method: 'GET' })
  .validator(input<CharacterRef>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return getCharacter(db, userId, data)
  })

export const listEventsFn = createServerFn({ method: 'GET' })
  .validator(input<CharacterRef>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return listEvents(db, userId, data)
  })

export const createDraftFn = createServerFn({ method: 'POST' })
  .validator(input<CreateDraftInput>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return createDraft(db, userId, data) // a draft has no campaign: nothing to publish
  })

export const saveDraftFn = createServerFn({ method: 'POST' })
  .validator(input<SaveDraftInput>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return saveDraft(db, userId, data) // a draft has no campaign: nothing to publish
  })

// After each write below commits, `publishCharacterWrite` tells the character's campaign channel (ruling 20, INV-LIVE).
// It is best effort: a failed publish is logged inside and never fails the write. A draft has no campaign, so nothing is sent.

export const finishDraftFn = createServerFn({ method: 'POST' })
  .validator(input<FinishDraftInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const result = await finishDraft(db, userId, data)
    await publishCharacterWrite(env, result)
    return result
  })

export const applyCharacterActionFn = createServerFn({ method: 'POST' })
  .validator(input<ApplyInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const result = await applyCharacterAction(db, userId, data)
    await publishCharacterWrite(env, result)
    return result
  })

export const undoCharacterEventFn = createServerFn({ method: 'POST' })
  .validator(input<UndoInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const result = await undoCharacterEvent(db, userId, data)
    await publishCharacterWrite(env, result)
    return result
  })
