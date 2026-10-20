// The character journal store (campaign spec §6): every read and write of `journal_entry`.
//
// Same shape as `characters.ts` (ruling 22): plain `(db, userId, input) → result` functions hold all the logic and the tests
// call them; the `createServerFn` wrappers at the bottom resolve the signed-in user and `env`. Expected refusals are values,
// `{ok: false, status, code, message}`; infrastructure failures throw.
//
// A journal entry is not character state (INV-ACTION): nothing here writes `character`, so `character.revision` never moves
// and there is no event or undo. INV-PRIVATE: an unshared entry is returned only to its author. Every query that crosses
// authors (`listSharedJournal`) filters `shared = 1`; the GM is not special. INV-AI: nothing in the AI server reads this table.
//
// A write that changes what campaign members can see returns `campaignId`; the wrapper then calls `publishJournalWrite`
// (INV-LIVE), the way character writes call `publishCharacterWrite`.
import { createServerFn } from '@tanstack/react-start'
import { ulid } from 'ulid'
import { characterRole, roleIn } from './authz'
import { publish } from './live'

// ---- Types -------------------------------------------------------------------------------------

export type JournalErrorCode = 'forbidden' | 'not_found' | 'bad_input' | 'not_in_campaign'

/** An expected refusal. */
export type JournalRefusal = { ok: false; status: number; code: JournalErrorCode; message: string }

/** An entry as its author sees it. */
export type JournalEntry = {
  id: string
  characterId: string
  body: string
  /** The campaign's `current_day` when the entry was written; null outside a campaign. */
  inGameDay: number | null
  /** The campaign's open session when the entry was written; null outside a campaign or between sessions. */
  sessionId: string | null
  /** That session's number ("Session 3"); null when `sessionId` is. */
  sessionNumber: number | null
  shared: boolean
  createdAt: string
  updatedAt: string
}

/** A shared entry as the campaign's members see it (no author-only fields). */
export type SharedJournalEntry = {
  id: string
  characterId: string
  characterName: string
  body: string
  inGameDay: number | null
  sessionId: string | null
  sessionNumber: number | null
  createdAt: string
  updatedAt: string
}

/**
 * A successful write. `campaignId` is set exactly when campaign members' view of shared entries changed (a share or unshare,
 * or an edit or delete of an entry that is shared) and tells the wrapper which campaign to publish to.
 */
export type WriteOk = { ok: true; entry: JournalEntry; campaignId: string | null }
export type DeleteOk = { ok: true; entryId: string; campaignId: string | null }

export type ListJournalInput = { characterId: string }
export type CreateJournalInput = { characterId: string; body: string }
export type EditJournalInput = { entryId: string; body: string }
export type DeleteJournalInput = { entryId: string }
export type SetSharedInput = { entryId: string; shared: boolean }
export type ListSharedInput = { campaignId: string }

// ---- Helpers -----------------------------------------------------------------------------------

const STATUS: Record<JournalErrorCode, number> = { forbidden: 403, not_found: 404, bad_input: 400, not_in_campaign: 409 }

const refuse = (code: JournalErrorCode, message: string): JournalRefusal => ({ ok: false, status: STATUS[code], code, message })

export const MAX_BODY_LENGTH = 20000

const badId = (id: unknown, what: string): JournalRefusal | null =>
  typeof id === 'string' && id ? null : refuse('bad_input', `${what} must be a non-empty string`)

function badBody(body: unknown): JournalRefusal | null {
  if (typeof body !== 'string' || !body.trim()) return refuse('bad_input', 'An entry needs some text')
  if (body.length > MAX_BODY_LENGTH) return refuse('bad_input', `An entry is at most ${MAX_BODY_LENGTH} characters`)
  return null
}

type EntryRow = {
  id: string
  character_id: string
  author_user_id: string
  body: string
  in_game_day: number | null
  session_id: string | null
  /** From `SESSION_NUMBER`, not a column of `journal_entry`. */
  session_number: number | null
  shared: number
  created_at: string
  updated_at: string
}

/** Every query that returns entry rows selects `*, ${SESSION_NUMBER}`, so an entry always carries its session's number. */
const SESSION_NUMBER = '(SELECT number FROM campaign_session WHERE campaign_session.id = journal_entry.session_id) AS session_number'

const toEntry = (r: EntryRow): JournalEntry => ({
  id: r.id,
  characterId: r.character_id,
  body: r.body,
  inGameDay: r.in_game_day,
  sessionId: r.session_id,
  sessionNumber: r.session_number,
  shared: r.shared === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

type CharacterRow = { id: string; owner_user_id: string; campaign_id: string | null }

async function characterOf(db: D1Database, characterId: string): Promise<CharacterRow | null> {
  return db.prepare('SELECT id, owner_user_id, campaign_id FROM character WHERE id = ?').bind(characterId).first<CharacterRow>()
}

/** The character, if the user owns it. The journal belongs to the character's owner alone; no campaign role grants access. */
async function ownCharacter(db: D1Database, userId: string, characterId: string): Promise<CharacterRow | JournalRefusal> {
  const character = await characterOf(db, characterId)
  if (!character) return refuse('not_found', 'No such character')
  // `draft` only matters to a non-owner, who is refused here either way, so the character's state is not read.
  const role = await characterRole(db, userId, { ownerUserId: character.owner_user_id, campaignId: character.campaign_id, draft: false })
  if (role !== 'owner') return refuse('forbidden', 'This journal is not yours')
  return character
}

const isRefusal = (v: object): v is JournalRefusal => 'ok' in v && (v as { ok: unknown }).ok === false

/** The entry and the campaign its character is in now, if the user wrote the entry. Any other user, the GM included, is refused. */
async function ownEntry(db: D1Database, userId: string, entryId: string): Promise<{ row: EntryRow; campaignId: string | null } | JournalRefusal> {
  const row = await db.prepare('SELECT * FROM journal_entry WHERE id = ?').bind(entryId).first<EntryRow>()
  if (!row) return refuse('not_found', 'No such journal entry')
  if (row.author_user_id !== userId) return refuse('forbidden', 'This entry is not yours')
  const character = await db.prepare('SELECT campaign_id FROM character WHERE id = ?').bind(row.character_id).first<{ campaign_id: string | null }>()
  return { row, campaignId: character?.campaign_id ?? null }
}

// ---- Operations --------------------------------------------------------------------------------

/** The user's own entries for one of their characters, newest first. */
export async function listJournal(db: D1Database, userId: string, input: ListJournalInput): Promise<{ ok: true; entries: JournalEntry[] } | JournalRefusal> {
  const bad = badId(input.characterId, 'characterId')
  if (bad) return bad
  const character = await ownCharacter(db, userId, input.characterId)
  if (isRefusal(character)) return character
  const { results } = await db
    .prepare(`SELECT *, ${SESSION_NUMBER} FROM journal_entry WHERE character_id = ? AND author_user_id = ? ORDER BY created_at DESC, id DESC`)
    .bind(character.id, userId)
    .all<EntryRow>()
  return { ok: true, entries: results.map(toEntry) }
}

/**
 * Writes a private entry. Day and session are stamped in the same statement from the character's campaign (its `current_day`
 * and its open session); both are null for a character in no campaign. Nothing is published: a new entry is not shared.
 */
export async function createJournalEntry(db: D1Database, userId: string, input: CreateJournalInput): Promise<WriteOk | JournalRefusal> {
  const bad = badId(input.characterId, 'characterId') ?? badBody(input.body)
  if (bad) return bad
  const character = await ownCharacter(db, userId, input.characterId)
  if (isRefusal(character)) return character
  const row = await db
    .prepare(
      `INSERT INTO journal_entry (id, character_id, author_user_id, body, in_game_day, session_id)
       VALUES (?, ?, ?, ?,
         (SELECT current_day FROM campaign WHERE id = ?),
         (SELECT id FROM campaign_session WHERE campaign_id = ? AND end_day IS NULL))
       RETURNING *, ${SESSION_NUMBER}`,
    )
    .bind(ulid(), character.id, userId, input.body, character.campaign_id, character.campaign_id)
    .first<EntryRow>()
  if (!row) throw new Error('journal_entry insert returned no row')
  return { ok: true, entry: toEntry(row), campaignId: null }
}

/** Replaces the body of the user's own entry. Members are told only when the entry is shared. */
export async function editJournalEntry(db: D1Database, userId: string, input: EditJournalInput): Promise<WriteOk | JournalRefusal> {
  const bad = badId(input.entryId, 'entryId') ?? badBody(input.body)
  if (bad) return bad
  const own = await ownEntry(db, userId, input.entryId)
  if (isRefusal(own)) return own
  const row = await db
    .prepare(`UPDATE journal_entry SET body = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND author_user_id = ? RETURNING *, ${SESSION_NUMBER}`)
    .bind(input.body, own.row.id, userId)
    .first<EntryRow>()
  if (!row) return refuse('not_found', 'No such journal entry')
  return { ok: true, entry: toEntry(row), campaignId: own.row.shared === 1 ? own.campaignId : null }
}

/** Deletes the user's own entry. Members are told only when it was shared. */
export async function deleteJournalEntry(db: D1Database, userId: string, input: DeleteJournalInput): Promise<DeleteOk | JournalRefusal> {
  const bad = badId(input.entryId, 'entryId')
  if (bad) return bad
  const own = await ownEntry(db, userId, input.entryId)
  if (isRefusal(own)) return own
  await db.prepare('DELETE FROM journal_entry WHERE id = ? AND author_user_id = ?').bind(own.row.id, userId).run()
  return { ok: true, entryId: own.row.id, campaignId: own.row.shared === 1 ? own.campaignId : null }
}

/**
 * Shares or unshares the user's own entry. Sharing needs the character to be in a campaign; unsharing never does.
 * Members are told when the switch actually changed.
 */
export async function setJournalShared(db: D1Database, userId: string, input: SetSharedInput): Promise<WriteOk | JournalRefusal> {
  const bad = badId(input.entryId, 'entryId') ?? (typeof input.shared === 'boolean' ? null : refuse('bad_input', 'shared must be true or false'))
  if (bad) return bad
  const own = await ownEntry(db, userId, input.entryId)
  if (isRefusal(own)) return own
  if (input.shared && own.campaignId === null) return refuse('not_in_campaign', 'This character is in no campaign to share with')
  const row = await db
    .prepare(`UPDATE journal_entry SET shared = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND author_user_id = ? RETURNING *, ${SESSION_NUMBER}`)
    .bind(input.shared ? 1 : 0, own.row.id, userId)
    .first<EntryRow>()
  if (!row) return refuse('not_found', 'No such journal entry')
  return { ok: true, entry: toEntry(row), campaignId: (own.row.shared === 1) !== input.shared ? own.campaignId : null }
}

/**
 * The shared entries of the campaign's characters, newest first, for the Sessions tab (group by `sessionId`; null is
 * "Between sessions"). Members only. Reads `shared = 1` rows alone (INV-PRIVATE).
 */
export async function listSharedJournal(db: D1Database, userId: string, input: ListSharedInput): Promise<{ ok: true; entries: SharedJournalEntry[] } | JournalRefusal> {
  const bad = badId(input.campaignId, 'campaignId')
  if (bad) return bad
  if ((await roleIn(db, input.campaignId, userId)) === null) return refuse('forbidden', 'You are not in this campaign')
  const { results } = await db
    .prepare(
      `SELECT journal_entry.*, ${SESSION_NUMBER}, c.name AS character_name
       FROM journal_entry JOIN character c ON c.id = journal_entry.character_id
       WHERE c.campaign_id = ? AND journal_entry.shared = 1
       ORDER BY journal_entry.created_at DESC, journal_entry.id DESC`,
    )
    .bind(input.campaignId)
    .all<EntryRow & { character_name: string }>()
  return {
    ok: true,
    entries: results.map((r) => ({
      id: r.id,
      characterId: r.character_id,
      characterName: r.character_name,
      body: r.body,
      inGameDay: r.in_game_day,
      sessionId: r.session_id,
      sessionNumber: r.session_number,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  }
}

/** After a journal write: tell the campaign's pages to refetch when the write changed what members can see (INV-LIVE, best effort). */
export async function publishJournalWrite(env: Parameters<typeof publish>[0], result: { ok: boolean; campaignId?: string | null }): Promise<void> {
  if (!result.ok || !result.campaignId) return
  await publish(env, result.campaignId, { type: 'campaign' })
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

export const listJournalFn = createServerFn({ method: 'GET' })
  .validator(input<ListJournalInput>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return listJournal(db, userId, data)
  })

export const listSharedJournalFn = createServerFn({ method: 'GET' })
  .validator(input<ListSharedInput>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return listSharedJournal(db, userId, data)
  })

export const createJournalEntryFn = createServerFn({ method: 'POST' })
  .validator(input<CreateJournalInput>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return createJournalEntry(db, userId, data) // a new entry is private: nothing to publish
  })

export const editJournalEntryFn = createServerFn({ method: 'POST' })
  .validator(input<EditJournalInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const result = await editJournalEntry(db, userId, data)
    await publishJournalWrite(env, result)
    return result
  })

export const deleteJournalEntryFn = createServerFn({ method: 'POST' })
  .validator(input<DeleteJournalInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const result = await deleteJournalEntry(db, userId, data)
    await publishJournalWrite(env, result)
    return result
  })

export const setJournalSharedFn = createServerFn({ method: 'POST' })
  .validator(input<SetSharedInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const result = await setJournalShared(db, userId, data)
    await publishJournalWrite(env, result)
    return result
  })
