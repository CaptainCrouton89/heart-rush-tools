import { env } from 'cloudflare:workers'
import { NotFoundError, type ConnectedCrouter } from '@north-light/sdk'
import {
  DEFAULT_PARTY,
  turnSchema,
  type Encounter,
  type Party,
  type StoredMessage,
  type Turn,
} from '~/encounter/schema'
import { cancelRunConfirmed, findRunByClaim, resultOf, RunCanceledError } from './runs'

/** How long a claim may stay without a run id before a page load or Stop treats its request as gone. */
export const STARTING_STALE_MS = 60_000

type Row = {
  id: string
  user_id: string
  title: string
  messages: string
  document: string | null
  active_run_id: string | null
  claim: string | null
  stop_requested: number
  created_at: string
  updated_at: string
}

/** An encounter row with its JSON columns parsed. */
export type EncounterRecord = Omit<Row, 'messages' | 'document'> & { messages: StoredMessage[]; document: Encounter | null }

const parse = (row: Row): EncounterRecord => ({
  ...row,
  messages: JSON.parse(row.messages) as StoredMessage[],
  document: row.document ? (JSON.parse(row.document) as Encounter) : null,
})

const now = () => new Date().toISOString()

// ---- party ------------------------------------------------------------------------------------------------------

export async function getParty(userId: string): Promise<Party> {
  const row = await env.DB.prepare('SELECT characters, bloodmarks, note FROM party WHERE user_id = ?')
    .bind(userId)
    .first<Party>()
  return row ?? DEFAULT_PARTY
}

export async function saveParty(userId: string, party: Party): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO party (user_id, characters, bloodmarks, note, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET characters = excluded.characters, bloodmarks = excluded.bloodmarks,
       note = excluded.note, updated_at = excluded.updated_at`,
  )
    .bind(userId, party.characters, party.bloodmarks, party.note, now())
    .run()
}

// ---- encounters -------------------------------------------------------------------------------------------------

export async function listEncounters(userId: string) {
  const { results } = await env.DB.prepare(
    `SELECT id, title, updated_at, document IS NOT NULL AS hasDocument FROM encounter
     WHERE user_id = ? ORDER BY updated_at DESC`,
  )
    .bind(userId)
    .all<{ id: string; title: string; updated_at: string; hasDocument: number }>()
  return results.map((r) => ({ ...r, hasDocument: r.hasDocument === 1 }))
}

export async function createEncounter(userId: string): Promise<string> {
  const id = crypto.randomUUID()
  const at = now()
  await env.DB.prepare(
    `INSERT INTO encounter (id, user_id, title, messages, document, created_at, updated_at)
     VALUES (?, ?, 'New encounter', '[]', NULL, ?, ?)`,
  )
    .bind(id, userId, at, at)
    .run()
  return id
}

/** One of this GM's encounters, or null (another GM's id is indistinguishable from a missing one). */
export async function loadEncounter(userId: string, id: string): Promise<EncounterRecord | null> {
  const row = await env.DB.prepare('SELECT * FROM encounter WHERE id = ? AND user_id = ?').bind(id, userId).first<Row>()
  return row ? parse(row) : null
}

export async function deleteEncounter(userId: string, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM encounter WHERE id = ? AND user_id = ?').bind(id, userId).run()
}

const changed = (result: D1Result) => result.meta.changes > 0

/**
 * Take the right to run this encounter: a fresh claim token, or null when a run is already claimed. Atomic, so two sends cannot
 * both start a run. Every later write for the run carries the token, so a request whose claim was released (Stop, delete, stale
 * recovery) or replaced can no longer change the encounter.
 */
export async function claim(userId: string, id: string): Promise<string | null> {
  const token = crypto.randomUUID()
  const won = changed(
    await env.DB.prepare(
      'UPDATE encounter SET claim = ?, active_run_id = NULL, stop_requested = 0, updated_at = ? WHERE id = ? AND user_id = ? AND claim IS NULL',
    )
      .bind(token, now(), id, userId)
      .run(),
  )
  return won ? token : null
}

/** Append the GM's message to an encounter claimed with `token`; null when the claim is gone. A resend of the unanswered message just before it is not stored twice. */
export async function appendGmMessage(enc: EncounterRecord, token: string, text: string): Promise<StoredMessage[] | null> {
  const last = enc.messages.at(-1)
  const messages: StoredMessage[] =
    last?.role === 'gm' && last.text === text ? enc.messages : [...enc.messages, { role: 'gm', text, at: now() }]
  const title = enc.messages.length === 0 ? text.replace(/\s+/g, ' ').slice(0, 60) : enc.title
  const won = changed(
    await env.DB.prepare(
      'UPDATE encounter SET messages = ?, title = ?, updated_at = ? WHERE id = ? AND user_id = ? AND claim = ?',
    )
      .bind(JSON.stringify(messages), title, now(), enc.id, enc.user_id, token)
      .run(),
  )
  return won ? messages : null
}

/**
 * Record the started run's id on the encounter claimed with `token`. Null when the claim is gone (delete, stale recovery);
 * otherwise whether a Stop arrived while the run was starting. Succeeds when recovery already recorded this same run.
 */
export async function recordRun(userId: string, id: string, token: string, runId: string): Promise<{ stopRequested: boolean } | null> {
  const row = await env.DB.prepare(
    `UPDATE encounter SET active_run_id = ? WHERE id = ? AND user_id = ? AND claim = ? AND (active_run_id IS NULL OR active_run_id = ?)
     RETURNING stop_requested`,
  )
    .bind(runId, id, userId, token, runId)
    .first<{ stop_requested: number }>()
  return row && { stopRequested: row.stop_requested === 1 }
}

/** Ask whoever records the run id of the encounter claimed with `token` to cancel it; false when the claim is gone. */
export async function requestStop(userId: string, id: string, token: string): Promise<boolean> {
  return changed(
    await env.DB.prepare('UPDATE encounter SET stop_requested = 1 WHERE id = ? AND user_id = ? AND claim = ? AND active_run_id IS NULL')
      .bind(id, userId, token)
      .run(),
  )
}

/**
 * Cancel the run held under `token` (found by its claim when its id was never recorded), then release the claim. Throws, and
 * keeps the claim, when the cancellation cannot be confirmed, so the encounter does not read idle while a run is still going.
 */
export async function cancelAndRelease(runtime: ConnectedCrouter, userId: string, id: string, token: string, runId: string | null) {
  const target = runId ?? (await findRunByClaim(runtime, token))?.run_id
  if (target) await cancelRunConfirmed(runtime, target)
  await release(userId, id, token)
}

/** Release the claim `token` and its run id; the messages stay. Does nothing when the claim is already gone or replaced. */
export async function release(userId: string, id: string, token: string): Promise<void> {
  await env.DB.prepare(
    'UPDATE encounter SET claim = NULL, active_run_id = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND claim = ?',
  )
    .bind(now(), id, userId, token)
    .run()
}

/** The stored form of the agent's turn: an `encounter` step keeps only its quick replies, since the document is stored apart. */
const storedAgentMessage = (turn: Turn): Extract<StoredMessage, { role: 'agent' }> => {
  const step = turn.step
  return {
    role: 'agent',
    text: turn.message,
    step: step.kind === 'encounter' ? { kind: 'encounter', suggestions: step.suggestions } : step,
    at: now(),
  }
}

/** The outcome of finishing a run: the stored agent message, and the document when the turn produced one. */
export type Finished = { message: Extract<StoredMessage, { role: 'agent' }>; document: Encounter | null }

/**
 * Store a settled turn and release the claim, once. The waiting request and a reloading page's `GET` can both reach a settled
 * run; whichever updates the row first wins, and the other returns what was stored. Null when the claim was released without
 * this turn being stored (Stop, delete).
 */
export async function finishRun(enc: EncounterRecord, token: string, turn: Turn): Promise<Finished | null> {
  const message = storedAgentMessage(turn)
  const document = turn.step.kind === 'encounter' ? turn.step.encounter : enc.document
  const title = turn.step.kind === 'encounter' ? turn.step.encounter.title : null // null keeps the title set from the first message
  const won = changed(
    await env.DB.prepare(
      `UPDATE encounter SET messages = ?, document = ?, title = COALESCE(?, title), claim = NULL, active_run_id = NULL, updated_at = ?
       WHERE id = ? AND user_id = ? AND claim = ?`,
    )
      .bind(JSON.stringify([...enc.messages, message]), document && JSON.stringify(document), title, now(), enc.id, enc.user_id, token)
      .run(),
  )
  if (won) return { message, document: turn.step.kind === 'encounter' ? document : null }
  const stored = await loadEncounter(enc.user_id, enc.id)
  const last = stored?.messages.at(-1)
  // Only the reply to this request's own message counts as "the other side stored it".
  if (!stored || last?.role !== 'agent' || stored.messages.length !== enc.messages.length + 1) return null
  return { message: last, document: turn.step.kind === 'encounter' ? stored.document : null }
}

/**
 * Bring an encounter's run state up to date for a page load. A settled result is stored; a failed, cancelled or deleted run
 * is released; a claim whose request died before recording a run is recovered (the run is found by its claim and adopted, or the
 * claim released); a run still going is reported as running. Returns the refreshed encounter. A run that cannot be confirmed
 * cancelled keeps the claim, so this throws and the encounter stays running.
 */
export async function reconcile(runtime: () => Promise<ConnectedCrouter>, enc: EncounterRecord): Promise<EncounterRecord> {
  const token = enc.claim
  if (!token) return enc
  const reload = async () => (await loadEncounter(enc.user_id, enc.id)) ?? enc
  const runId = enc.active_run_id
  if (runId && enc.stop_requested) {
    await cancelAndRelease(await runtime(), enc.user_id, enc.id, token, runId)
    return reload()
  }
  if (!runId) {
    if (Date.now() - Date.parse(enc.updated_at) <= STARTING_STALE_MS) return enc
    const run = await findRunByClaim(await runtime(), token)
    if (!run) await release(enc.user_id, enc.id, token)
    else if (await recordRun(enc.user_id, enc.id, token, run.run_id)) return reconcile(runtime, await reload())
    return reload()
  }
  const rt = await runtime()
  let run
  try {
    run = await rt.runs.get(runId)
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error
    await release(enc.user_id, enc.id, token)
    return reload()
  }
  if (run.status === 'running') return enc
  try {
    await finishRun(enc, token, resultOf(run, turnSchema))
  } catch (error) {
    if (!(error instanceof RunCanceledError)) console.error('encounter run ended without a usable result', runId, error)
    await cancelRunConfirmed(rt, runId) // a run at rest (idle, waiting on a question) would otherwise hold the encounter forever
    await release(enc.user_id, enc.id, token)
  }
  return reload()
}
