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
import { cancelRun, resultOf, RunCanceledError } from './runs'

/** `active_run_id` while a message is claimed but its run has not started yet. */
export const STARTING = 'starting'
const STARTING_STALE_MS = 60_000

type Row = {
  id: string
  user_id: string
  title: string
  messages: string
  document: string | null
  active_run_id: string | null
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
    `INSERT INTO encounter (id, user_id, title, messages, document, active_run_id, created_at, updated_at)
     VALUES (?, ?, 'New encounter', '[]', NULL, NULL, ?, ?)`,
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

/** Take the right to run this encounter: true when no run was active. Atomic, so two sends cannot both start a run. */
export async function claim(userId: string, id: string): Promise<boolean> {
  return changed(
    await env.DB.prepare(
      'UPDATE encounter SET active_run_id = ?, updated_at = ? WHERE id = ? AND user_id = ? AND active_run_id IS NULL',
    )
      .bind(STARTING, now(), id, userId)
      .run(),
  )
}

/** Append the GM's message to a claimed encounter. A resend of the unanswered message just before it is not stored twice. */
export async function appendGmMessage(enc: EncounterRecord, text: string): Promise<StoredMessage[]> {
  const last = enc.messages.at(-1)
  const messages: StoredMessage[] =
    last?.role === 'gm' && last.text === text ? enc.messages : [...enc.messages, { role: 'gm', text, at: now() }]
  const title = enc.messages.length === 0 ? text.replace(/\s+/g, ' ').slice(0, 60) : enc.title
  await env.DB.prepare('UPDATE encounter SET messages = ?, title = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(JSON.stringify(messages), title, now(), enc.id, enc.user_id)
    .run()
  return messages
}

/** Record the started run's id on a claimed encounter; false when the claim was released meanwhile (Stop, delete). */
export async function recordRun(userId: string, id: string, runId: string): Promise<boolean> {
  return changed(
    await env.DB.prepare('UPDATE encounter SET active_run_id = ? WHERE id = ? AND user_id = ? AND active_run_id = ?')
      .bind(runId, id, userId, STARTING)
      .run(),
  )
}

/** Release the run on this encounter if it is still `runId`; the messages stay. */
export async function release(userId: string, id: string, runId: string): Promise<void> {
  await env.DB.prepare('UPDATE encounter SET active_run_id = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND active_run_id = ?')
    .bind(now(), id, userId, runId)
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
 * Store a settled turn and release the run, once. The waiting request and a reloading page's `GET` can both reach a settled
 * run; whichever updates the row first wins, and the other returns what was stored.
 */
export async function finishRun(enc: EncounterRecord, runId: string, turn: Turn): Promise<Finished> {
  const message = storedAgentMessage(turn)
  const document = turn.step.kind === 'encounter' ? turn.step.encounter : enc.document
  const title = turn.step.kind === 'encounter' ? turn.step.encounter.title : null // null keeps the title set from the first message
  const won = changed(
    await env.DB.prepare(
      `UPDATE encounter SET messages = ?, document = ?, title = COALESCE(?, title), active_run_id = NULL, updated_at = ?
       WHERE id = ? AND user_id = ? AND active_run_id = ?`,
    )
      .bind(JSON.stringify([...enc.messages, message]), document && JSON.stringify(document), title, now(), enc.id, enc.user_id, runId)
      .run(),
  )
  if (won) return { message, document: turn.step.kind === 'encounter' ? document : null }
  const stored = await loadEncounter(enc.user_id, enc.id)
  const last = stored?.messages.at(-1)
  if (last?.role !== 'agent') throw new Error('The run was released before its result was stored')
  return { message: last, document: turn.step.kind === 'encounter' ? stored!.document : null }
}

/**
 * Bring an encounter's run state up to date for a page load. A settled result is stored; a failed, cancelled or deleted run
 * is released; a run still going is reported as running. Returns the refreshed encounter.
 */
export async function reconcile(runtime: () => Promise<ConnectedCrouter>, enc: EncounterRecord): Promise<EncounterRecord> {
  const runId = enc.active_run_id
  if (!runId) return enc
  if (runId === STARTING) {
    if (Date.now() - Date.parse(enc.updated_at) > STARTING_STALE_MS) await release(enc.user_id, enc.id, STARTING)
    return (await loadEncounter(enc.user_id, enc.id)) ?? enc
  }
  const rt = await runtime()
  let run
  try {
    run = await rt.runs.get(runId)
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error
    await release(enc.user_id, enc.id, runId)
    return (await loadEncounter(enc.user_id, enc.id)) ?? enc
  }
  if (run.status === 'running') return enc
  try {
    await finishRun(enc, runId, resultOf(run, turnSchema))
  } catch (error) {
    if (!(error instanceof RunCanceledError)) console.error('encounter run ended without a usable result', runId, error)
    await cancelRun(rt, runId) // a run at rest (idle, waiting on a question) would otherwise hold the encounter forever
    await release(enc.user_id, enc.id, runId)
  }
  return (await loadEncounter(enc.user_id, enc.id)) ?? enc
}
