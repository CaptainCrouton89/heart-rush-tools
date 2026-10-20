// The creation assistant's server (design "Server functions", "Reconcile", "Finish"): the chat row, the run lifecycle and the
// authorization every call shares. Plain `(deps, userId, input)` functions (ruling 22) with `createServerFn` wrappers at the bottom.
//
// The run never writes the character: it returns a turn, `settleTurn` drops what the rules refuse, and the stored turn is the only
// thing written (to `builder_chat`, never to `character`). Only the player's Apply, in the browser, changes the draft.
// INV-AUTHZ: one query is the whole authorization (owner + draft + chat not archived); anything else is `not_found`, so a
// stranger cannot tell that a draft exists. Expected outcomes are values; infrastructure failures throw.
import { createServerFn } from '@tanstack/react-start'
import type { ConnectedCrouter, RunObject } from '@north-light/sdk'
import { NotFoundError } from '@north-light/sdk'
import { cancelRunConfirmed, findRunByClaim, needsSignIn, startRun } from '@heartrush/northlight/runs'
import { upgradeCharacter } from '@heartrush/rules-engine/actions'
import type { DraftState } from '@heartrush/rules-engine/types'
import { ulid } from 'ulid'
import { getCatalogue } from '~/catalogue'
import { settleTurn } from '~/assistant/card'
import { MAX_MESSAGE_LENGTH, turnSchema, type AssistantMessage, type ChatError, type ChatErrorReason, type StoredMessage } from '~/assistant/schema'
import type { DraftContent } from '~/components/builder/draft-rules'
import { assistantPrompt } from './assistant-prompt'

// ---- Types -------------------------------------------------------------------------------------

export type { ChatError, StoredMessage }

/** What every chat function answers with on success (`getChat`, `sendChat`). `running` while a run holds the chat. */
export type ChatState = {
  ok: true
  messages: StoredMessage[]
  running: { startedAt: string } | null
  error: ChatError | null
}
export type ChatFailure = { ok: false; code: 'not_found' | 'busy' | 'bad_input'; message: string }
export type StopResult = { ok: true; stopped: boolean; retryable?: true } | ChatFailure

export type GetChatInput = { characterId: string; wait: boolean }
export type SendChatInput = { characterId: string } & ({ message: { id: string; text: string }; retry?: undefined } | { retry: true; message?: undefined })
export type StopChatInput = { characterId: string }

/** `runtimeFor` is `authFor(request).runtimeFor`; a person without a stored connection throws `not_connected`. */
export type AssistantDeps = { db: D1Database; runtimeFor: (userId: string) => Promise<ConnectedCrouter> }

// ---- Constants ---------------------------------------------------------------------------------

/** The run's wall-clock limit (it settles `deadline_exceeded`). */
export const RUN_DEADLINE = '15m'
/** How long a claim may stay without a run id before a page load or Stop treats its request as gone. */
export const STARTING_STALE_MS = 60_000
/** One `getChat({wait: true})` waits this long; the abort only stops waiting and never cancels. */
export const WAIT_MS = 20_000
const STOP_WAIT_MS = 15_000
const STOP_POLL_MS = 400

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const now = () => new Date().toISOString()
const failure = (code: ChatFailure['code'], message: string): ChatFailure => ({ ok: false, code, message })
const NOT_FOUND = failure('not_found', 'No such draft')

// ---- The row and its one authorization query ----------------------------------------------------

type ChatRow = {
  characterId: string
  draft: DraftContent
  messages: StoredMessage[]
  claim: string | null
  claimedAt: string | null
  activeRunId: string | null
  stopRequested: boolean
  error: ChatError | null
}

type RawRow = {
  state: string
  messages: string | null
  claim: string | null
  claimed_at: string | null
  active_run_id: string | null
  stop_requested: number | null
  last_error: string | null
}

/**
 * The chat of a draft the user owns, or null. This is the whole authorization: the character must be the user's, still a draft,
 * and its chat (a missing row counts as an empty one) not archived. The GM, another user, a finished character and a bad id
 * are all the same absence.
 */
async function load(db: D1Database, userId: string, characterId: unknown): Promise<ChatRow | null> {
  if (typeof characterId !== 'string' || !characterId) return null
  const raw = await db
    .prepare(
      `SELECT ch.state, bc.messages, bc.claim, bc.claimed_at, bc.active_run_id, bc.stop_requested, bc.last_error
         FROM character ch LEFT JOIN builder_chat bc ON bc.character_id = ch.id
        WHERE ch.id = ? AND ch.owner_user_id = ? AND json_extract(ch.state, '$.draft') = 1 AND COALESCE(bc.archived, 0) = 0`,
    )
    .bind(characterId, userId)
    .first<RawRow>()
  if (!raw) return null
  const state = upgradeCharacter(JSON.parse(raw.state)) as DraftState
  return {
    characterId,
    draft: { builder: state.builder, pending: state.pending },
    messages: raw.messages ? (JSON.parse(raw.messages) as StoredMessage[]) : [],
    claim: raw.claim,
    claimedAt: raw.claimed_at,
    activeRunId: raw.active_run_id,
    stopRequested: raw.stop_requested === 1,
    error: raw.last_error ? (JSON.parse(raw.last_error) as ChatError) : null,
  }
}

const stateOf = (row: ChatRow): ChatState => ({
  ok: true,
  messages: row.messages,
  running: row.claim ? { startedAt: row.claimedAt ?? '' } : null,
  error: row.claim ? null : row.error,
})

const changed = (result: D1Result) => result.meta.changes > 0

/** Release the claim `claim` and its run id, storing why no turn came (null stores none). Does nothing when the claim is gone or replaced. */
async function release(db: D1Database, characterId: string, claim: string, reason: ChatErrorReason | null): Promise<void> {
  await db
    .prepare(
      `UPDATE builder_chat SET claim = NULL, claimed_at = NULL, active_run_id = NULL, stop_requested = 0, last_error = ?, updated_at = ?
        WHERE character_id = ? AND claim = ?`,
    )
    .bind(reason && JSON.stringify({ reason } satisfies ChatError), now(), characterId, claim)
    .run()
}

/** Why a settled run gave no turn. */
function reasonOf(run: RunObject): ChatErrorReason {
  const outcome = run.status === 'settled' ? run.outcome : undefined
  if (outcome?.kind === 'failure') {
    if (outcome.reason === 'declined') return 'declined'
    if (outcome.reason === 'deadline_exceeded') return 'deadline_exceeded'
    if (outcome.reason === 'canceled') return 'stopped'
  }
  return 'runtime_error'
}

const hasResult = (run: RunObject) => run.status === 'settled' && run.outcome?.kind === 'result'

// ---- Settling and reconciling ---------------------------------------------------------------------

/**
 * Store a settled run's turn and release the claim, once. The waiting request and a reloading tab can both reach a settled run;
 * whichever updates the row first wins (the update carries the claim), and the other returns what was stored. A result that does
 * not match the turn schema is `runtime_error`.
 */
async function settle(db: D1Database, row: ChatRow, claim: string, run: RunObject): Promise<void> {
  const parsed = turnSchema.safeParse(run.result)
  if (!parsed.success) {
    console.error('assistant: result did not match the turn schema', parsed.error.message)
    return release(db, row.characterId, claim, 'runtime_error')
  }
  const turn = settleTurn(parsed.data, row.draft, getCatalogue())
  const message: AssistantMessage = { id: ulid(), role: 'assistant', text: turn.text, decision: turn.decision, card: turn.card, at: now(), runId: run.run_id }
  await db
    .prepare(
      `UPDATE builder_chat SET messages = ?, claim = NULL, claimed_at = NULL, active_run_id = NULL, stop_requested = 0, last_error = NULL, updated_at = ?
        WHERE character_id = ? AND claim = ?`,
    )
    .bind(JSON.stringify([...row.messages, message]), now(), row.characterId, claim)
    .run()
}

/** Cancel whatever run `claim` holds (found by its claim when its id was never recorded); throws when that cannot be confirmed. */
async function cancelHeld(runtime: ConnectedCrouter, claim: string, runId: string | null): Promise<RunObject | undefined> {
  const target = runId ?? (await findRunByClaim(runtime, claim))?.run_id
  return target ? cancelRunConfirmed(runtime, target) : undefined
}

/**
 * Bring the chat's run state up to date for a read: a settled result is stored; a failed, cancelled or deleted run is released;
 * a claim whose request died before recording a run is recovered (the run is found by its claim and adopted, or the claim
 * released); a run still going stays. A run that cannot be confirmed cancelled keeps the claim, so this throws. An error that
 * means the person must sign in again releases the claim as `not_connected`.
 */
async function reconcile(deps: AssistantDeps, userId: string, row: ChatRow): Promise<ChatRow | null> {
  const claim = row.claim
  if (!claim) return row
  const reload = () => load(deps.db, userId, row.characterId)
  try {
    if (row.stopRequested) {
      await cancelHeld(await deps.runtimeFor(userId), claim, row.activeRunId)
      await release(deps.db, row.characterId, claim, 'stopped')
      return reload()
    }
    if (!row.activeRunId) {
      if (Date.now() - Date.parse(row.claimedAt ?? '') <= STARTING_STALE_MS) return row
      const found = await findRunByClaim(await deps.runtimeFor(userId), claim)
      if (!found) await release(deps.db, row.characterId, claim, 'runtime_error')
      else if (await recordRun(deps.db, row.characterId, claim, found.run_id)) {
        const next = await reload()
        return next && reconcile(deps, userId, next)
      }
      return reload()
    }
    const runtime = await deps.runtimeFor(userId)
    let run: RunObject
    try {
      run = await runtime.runs.get(row.activeRunId)
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error
      await release(deps.db, row.characterId, claim, 'runtime_error')
      return reload()
    }
    if (run.status === 'running') return row
    if (hasResult(run)) await settle(deps.db, row, claim, run)
    else {
      // A run at rest (idle, waiting on a question) would otherwise hold the chat forever.
      if (run.status !== 'settled') await cancelRunConfirmed(runtime, run.run_id)
      await release(deps.db, row.characterId, claim, reasonOf(run))
    }
    return reload()
  } catch (error) {
    if (!needsSignIn(error)) throw error
    await release(deps.db, row.characterId, claim, 'not_connected')
    return reload()
  }
}

/** Record the started run's id on the chat claimed with `claim`. Null when the claim is gone; otherwise whether a Stop arrived while the run was starting. */
async function recordRun(db: D1Database, characterId: string, claim: string, runId: string): Promise<{ stopRequested: boolean } | null> {
  const row = await db
    .prepare(
      `UPDATE builder_chat SET active_run_id = ? WHERE character_id = ? AND claim = ? AND (active_run_id IS NULL OR active_run_id = ?)
       RETURNING stop_requested`,
    )
    .bind(runId, characterId, claim, runId)
    .first<{ stop_requested: number }>()
  return row && { stopRequested: row.stop_requested === 1 }
}

// ---- getChat -----------------------------------------------------------------------------------------

/**
 * The chat as stored, after reconciling its run. With `wait` and a run in flight it waits up to 20 s for the run to finish
 * (aborting only stops waiting), then reconciles again; the browser loops this while `running`.
 */
export async function getChat(deps: AssistantDeps, userId: string, input: GetChatInput): Promise<ChatState | ChatFailure> {
  let row = await load(deps.db, userId, input?.characterId)
  if (!row) return NOT_FOUND
  row = await reconcile(deps, userId, row)
  if (!row) return NOT_FOUND
  if (input.wait === true && row.claim && row.activeRunId && !row.stopRequested) {
    const signal = AbortSignal.timeout(WAIT_MS)
    try {
      await (await deps.runtimeFor(userId)).runs.wait(row.activeRunId, { signal })
    } catch (error) {
      if (!signal.aborted && !needsSignIn(error) && !(error instanceof NotFoundError)) throw error // reconcile below handles the rest
    }
    row = await load(deps.db, userId, row.characterId)
    row = row && (await reconcile(deps, userId, row))
    if (!row) return NOT_FOUND
  }
  return stateOf(row)
}

// ---- sendChat ------------------------------------------------------------------------------------------

/**
 * Take the right to run this chat: a fresh claim token, or null when a run already holds it (or the chat was archived).
 * The row is inserted first when the draft has had no message, guarded on the character still being a draft so a Finish
 * that committed in between cannot leave an unarchived chat behind.
 */
async function claimChat(db: D1Database, characterId: string): Promise<string | null> {
  await db
    .prepare("INSERT OR IGNORE INTO builder_chat (character_id) SELECT id FROM character WHERE id = ? AND json_extract(state, '$.draft') = 1")
    .bind(characterId)
    .run()
  const claim = ulid()
  const at = now()
  const won = changed(
    await db
      .prepare(
        `UPDATE builder_chat SET claim = ?, claimed_at = ?, active_run_id = NULL, stop_requested = 0, updated_at = ?
          WHERE character_id = ? AND claim IS NULL AND archived = 0`,
      )
      .bind(claim, at, at, characterId)
      .run(),
  )
  return won ? claim : null
}

/**
 * Append the player's message (or, on `retry`, answer the last one again), start a run on the player's runtime and record its id.
 * Returns at once with the chat running; the browser waits with `getChat`. `busy` means another run holds the chat: adopt it.
 * The player's message is kept whatever happens to the run; a runtime that cannot be had stores `not_connected`.
 */
export async function sendChat(deps: AssistantDeps, userId: string, input: SendChatInput): Promise<ChatState | ChatFailure> {
  if (!(await load(deps.db, userId, input?.characterId))) return NOT_FOUND
  const characterId = input.characterId
  let text: string | null = null
  if (input.retry !== true) {
    text = typeof input.message?.text === 'string' ? input.message.text.trim() : ''
    if (!text) return failure('bad_input', 'The message is empty')
    if (text.length > MAX_MESSAGE_LENGTH) return failure('bad_input', `A message is at most ${MAX_MESSAGE_LENGTH} characters`)
    if (typeof input.message?.id !== 'string' || !input.message.id) return failure('bad_input', 'The message needs an id')
  }

  const claim = await claimChat(deps.db, characterId)
  const row = await load(deps.db, userId, characterId)
  if (!row) return NOT_FOUND // archived by a Finish that committed first
  if (!claim) return failure('busy', 'The assistant is already answering')

  let messages = row.messages
  if (input.retry === true) {
    if (messages.at(-1)?.role !== 'player') {
      await release(deps.db, characterId, claim, null)
      return failure('bad_input', 'There is no message to answer again')
    }
  } else if (!messages.some((m) => m.id === input.message!.id)) {
    messages = [...messages, { id: input.message!.id, role: 'player', text: text!, at: now() }]
  }
  const kept = await deps.db
    .prepare('UPDATE builder_chat SET messages = ?, last_error = NULL, updated_at = ? WHERE character_id = ? AND claim = ?')
    .bind(JSON.stringify(messages), now(), characterId, claim)
    .run()
  if (!changed(kept)) return current(deps.db, userId, characterId)

  // From here the player's message is stored: every failure releases the claim with a reason instead of throwing it away.
  let runId: string
  try {
    const runtime = await deps.runtimeFor(userId)
    const prompt = assistantPrompt(row.draft, messages, getCatalogue())
    runId = await startRun(runtime, prompt, turnSchema, RUN_DEADLINE, undefined, {
      key: claim,
      metadata: { feature: 'builder-assistant', characterId, claim },
    })
    const recorded = await recordRun(deps.db, characterId, claim, runId)
    if (!recorded) {
      await cancelRunConfirmed(runtime, runId).catch((e) => console.error('assistant: could not cancel an orphaned run', runId, e))
    } else if (recorded.stopRequested) {
      await cancelRunConfirmed(runtime, runId)
      await release(deps.db, characterId, claim, 'stopped')
    }
  } catch (error) {
    if (!needsSignIn(error)) console.error('assistant: could not start a run', error instanceof Error ? error.message : error)
    await release(deps.db, characterId, claim, needsSignIn(error) ? 'not_connected' : 'runtime_error')
  }
  return current(deps.db, userId, characterId)
}

async function current(db: D1Database, userId: string, characterId: string): Promise<ChatState | ChatFailure> {
  const row = await load(db, userId, characterId)
  return row ? stateOf(row) : NOT_FOUND
}

// ---- stopChat ------------------------------------------------------------------------------------------

/**
 * Stop the chat's run and answer only once it is confirmed cancelled and the claim released (`stopped: true`). Nothing running
 * answers `stopped: false`. `retryable` means the cancellation could not be confirmed (or the run was still starting after 15 s;
 * the Stop is recorded and the starting request will cancel it): the chat stays running, Stop again. A run that finished with a
 * result before the cancel took effect is settled normally and counts as not stopped.
 */
export async function stopChat(deps: AssistantDeps, userId: string, input: StopChatInput): Promise<StopResult> {
  const deadline = Date.now() + STOP_WAIT_MS
  let waited = false // a Stop that waited on a starting run is what ended it
  for (;;) {
    const row = await load(deps.db, userId, input?.characterId)
    if (!row) return NOT_FOUND
    const claim = row.claim
    if (!claim) return { ok: true, stopped: waited }
    const starting = row.activeRunId === null
    if (starting && Date.now() - Date.parse(row.claimedAt ?? '') <= STARTING_STALE_MS) {
      // The run is still starting: its own request cancels it as soon as it knows the run id.
      const asked = await deps.db
        .prepare('UPDATE builder_chat SET stop_requested = 1 WHERE character_id = ? AND claim = ? AND active_run_id IS NULL')
        .bind(row.characterId, claim)
        .run()
      waited = changed(asked) || waited
      if (Date.now() >= deadline) return { ok: true, stopped: false, retryable: true }
      await sleep(STOP_POLL_MS)
      continue
    }
    try {
      const runtime = await deps.runtimeFor(userId)
      // A claim that never recorded a run id and is stale has lost its request: its run is found by claim.
      let run = await cancelHeld(runtime, claim, row.activeRunId)
      while (run && run.status === 'running') {
        if (Date.now() >= deadline) return { ok: true, stopped: false, retryable: true }
        await sleep(STOP_POLL_MS)
        run = await runtime.runs.get(run.run_id)
      }
      if (run && hasResult(run)) {
        await settle(deps.db, row, claim, run)
        return { ok: true, stopped: false }
      }
      await release(deps.db, row.characterId, claim, 'stopped')
      return { ok: true, stopped: true }
    } catch (error) {
      if (needsSignIn(error)) {
        await release(deps.db, row.characterId, claim, 'not_connected')
        return { ok: true, stopped: false }
      }
      console.error('assistant: could not stop the run', row.characterId, error instanceof Error ? error.message : error)
      return { ok: true, stopped: false, retryable: true }
    }
  }
}

// ---- Server functions (ruling 22) ------------------------------------------------------------------------
// Thin wrappers: resolve the signed-in user (INV-AUTHZ) and pass `env.DB` with the person's runtime. The imports are dynamic so
// the plain functions above load under node for the tests. All three are POST: none may be cached, and the wait loop calls
// `getChat` for minutes.

async function context() {
  const [{ requireUser }, { authFor }, { env }, { getRequest }] = await Promise.all([
    import('./session'), import('./auth'), import('cloudflare:workers'), import('@tanstack/react-start/server'),
  ])
  const request = getRequest()
  const { userId } = await requireUser(request)
  const deps: AssistantDeps = { db: env.DB, runtimeFor: (id) => authFor(request).runtimeFor(id) }
  return { deps, userId }
}

const input = <T>() => (data: unknown) => data as T

export const getChatFn = createServerFn({ method: 'POST' })
  .validator(input<GetChatInput>())
  .handler(async ({ data }): Promise<ChatState | ChatFailure> => {
    const { deps, userId } = await context()
    return getChat(deps, userId, data)
  })

export const sendChatFn = createServerFn({ method: 'POST' })
  .validator(input<SendChatInput>())
  .handler(async ({ data }): Promise<ChatState | ChatFailure> => {
    const { deps, userId } = await context()
    return sendChat(deps, userId, data)
  })

export const stopChatFn = createServerFn({ method: 'POST' })
  .validator(input<StopChatInput>())
  .handler(async ({ data }): Promise<StopResult> => {
    const { deps, userId } = await context()
    return stopChat(deps, userId, data)
  })
