// What a campaign holds besides members and XP (spec §2.1–§2.3, §7.3): the day counter, the session log, stratagems, and
// the encounters attached to sessions.
//
// Same shape as `campaigns.ts` and `rolls.ts` (ruling 22): plain functions hold all the logic and the tests call them; the
// `createServerFn` wrappers at the bottom resolve the signed-in user and `env`. Reads are `(db, userId, campaignId)`; writes
// are `(db, env, userId, campaignId, input)` and publish `{type: 'campaign'}` themselves once the write has committed
// (INV-LIVE, best effort), so the tools service binding gets the same publishing as the wrappers. Expected refusals are
// values, `{ok: false, status, code, message}`; infrastructure failures throw.
//
// INV-AUTHZ: every function resolves the caller's role from `campaign_member`; every write is GM only, every read is members
// only, and a session or stratagem id is always looked up together with the campaign id, so an id from another campaign
// is "not found". Nothing here touches `character`, `character_event` or any revision: a day change moves no sheet.
import { createServerFn } from '@tanstack/react-start'
import { objectiveCn, type Stratagem } from '@heartrush/rules-engine/stratagem'
import { roleIn } from './authz'
import { listSharedJournal, type SharedJournalEntry } from './journal'
import { publish } from './live'

// ---- Types -------------------------------------------------------------------------------------

export type CampaignPlayErrorCode = 'forbidden' | 'not_found' | 'bad_input' | 'session_open' | 'session_closed'

/** An expected refusal. */
export type CampaignPlayRefusal = { ok: false; status: number; code: CampaignPlayErrorCode; message: string }

/** An award logged on a session while it was open (spec §2.2). */
export type SessionXpAward = { amount: number; at: string }

export type SessionEncounter = {
  encounterId: string
  title: string
  attachedAt: string
  /** The encounter's page on tools.heartrush.party. */
  url: string
}

export type SessionView = {
  id: string
  number: number
  /** YYYY-MM-DD. */
  realDate: string
  startDay: number
  /** Null while the session is open. */
  endDay: number | null
  open: boolean
  /** Markdown. */
  recap: string
  xpAwards: SessionXpAward[]
  encounters: SessionEncounter[]
  /** The shared journal entries written during this session, newest first. */
  journal: SharedJournalEntry[]
}

export type SessionList = {
  ok: true
  /** Newest first. */
  sessions: SessionView[]
  /** Shared journal entries written with no session open: the Sessions tab's "Between sessions" group. */
  betweenSessions: SharedJournalEntry[]
}

export type ObjectiveState = 'open' | 'done' | 'gone'
export type AssetKind = 'asset' | 'hindrance'
export type StratagemStatus = 'active' | 'finished' | 'abandoned'

/** An objective as stored and as written. The leader key is `leaderCharacterId`, which the roll server reads (migration 0101). */
export type ObjectiveInput = { title: string; cn: number | null; leaderCharacterId: string | null; state: ObjectiveState }
export type AssetInput = { name: string; kind: AssetKind }

export type ObjectiveView = ObjectiveInput & {
  /** The leader's character name; null with no leader or when the leader has left the campaign. */
  leaderName: string | null
  /** The objective's current CN (own CN or the setup CN, ±3 per asset or hindrance); null unless the objective is open. */
  currentCn: number | null
}

export type StratagemView = {
  id: string
  goal: string
  timePerRoll: string
  setupCn: number
  status: StratagemStatus
  position: number
  objectives: ObjectiveView[]
  assets: AssetInput[]
  createdAt: string
}

export type SetDayInput = { add: number } | { set: number }
export type StartSessionInput = { /** YYYY-MM-DD in the GM's calendar; defaults to today in UTC. */ realDate?: string }
export type SessionRef = { sessionId: string }
export type EditRecapInput = SessionRef & { recap: string }
export type CreateStratagemInput = {
  goal: string
  timePerRoll: string
  setupCn: number
  objectives?: ObjectiveInput[]
  assets?: AssetInput[]
  status?: StratagemStatus
}
export type UpdateStratagemInput = { stratagemId: string } & Partial<CreateStratagemInput> & { position?: number }
export type AttachEncounterInput = { encounterId: string; title: string }
export type RemoveEncounterInput = { encounterId: string }

// ---- Limits and helpers ------------------------------------------------------------------------

export const MAX_DAY = 1_000_000
export const MAX_RECAP_LENGTH = 20000
export const MAX_TEXT_LENGTH = 200
export const MAX_CN = 1000
export const MAX_OBJECTIVES = 50
export const MAX_ASSETS = 100
/** Encounter pages live here; the path is the one the encounter builder uses for a saved encounter. */
export const TOOLS_ORIGIN = 'https://tools.heartrush.party'

const STATUS: Record<CampaignPlayErrorCode, number> = { forbidden: 403, not_found: 404, bad_input: 400, session_open: 409, session_closed: 409 }
const refuse = (code: CampaignPlayErrorCode, message: string): CampaignPlayRefusal => ({ ok: false, status: STATUS[code], code, message })

type ChannelEnv = Parameters<typeof publish>[0]

const badId = (id: unknown, what: string): CampaignPlayRefusal | null =>
  typeof id === 'string' && id ? null : refuse('bad_input', `${what} must be a non-empty string`)

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Refuses a key the function does not know, so a misspelled field is an error instead of a silent no-op. */
const unknownKey = (v: Record<string, unknown>, allowed: readonly string[], what: string): CampaignPlayRefusal | null => {
  const extra = Object.keys(v).find((k) => !allowed.includes(k))
  return extra === undefined ? null : refuse('bad_input', `${what} has no field "${extra}"`)
}

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max

/** The caller's role, or the refusal to return when they have none (a non-member learns nothing else). */
async function memberRefusal(db: D1Database, userId: string, campaignId: unknown): Promise<CampaignPlayRefusal | null> {
  const bad = badId(campaignId, 'campaignId')
  if (bad) return bad
  return (await roleIn(db, campaignId as string, userId)) === null ? refuse('forbidden', 'You are not in this campaign') : null
}

async function gmRefusal(db: D1Database, userId: string, campaignId: unknown): Promise<CampaignPlayRefusal | null> {
  const bad = badId(campaignId, 'campaignId')
  if (bad) return bad
  const role = await roleIn(db, campaignId as string, userId)
  if (role === null) return refuse('forbidden', 'You are not in this campaign')
  return role === 'gm' ? null : refuse('forbidden', 'Only the GM can do that')
}

/** After a campaign write has committed: tell the campaign's pages to refetch (best effort). */
const changed = (env: ChannelEnv, campaignId: string) => publish(env, campaignId, { type: 'campaign' })

// ---- Day (spec §2.1) ---------------------------------------------------------------------------

/**
 * The GM moves the in-game day: `{add: n}` adds a whole number of days (+1 day, +7 days), `{set: n}` sets it. The day is an
 * integer from 1 to `MAX_DAY`. It is a campaign field only; no character, revision or event changes (spec criterion 5).
 */
export async function setDay(
  db: D1Database, env: ChannelEnv, userId: string, campaignId: string, input: SetDayInput,
): Promise<{ ok: true; currentDay: number } | CampaignPlayRefusal> {
  const denied = await gmRefusal(db, userId, campaignId)
  if (denied) return denied
  const add = isObject(input) && 'add' in input && !('set' in input) ? input.add : undefined
  const set = isObject(input) && 'set' in input && !('add' in input) ? input.set : undefined
  let row: { current_day: number } | null
  if (add !== undefined) {
    if (!isInt(add, 1, MAX_DAY)) return refuse('bad_input', `Days to add must be a whole number from 1 to ${MAX_DAY}`)
    row = await db
      .prepare('UPDATE campaign SET current_day = current_day + ? WHERE id = ? AND current_day + ? <= ? RETURNING current_day')
      .bind(add, campaignId, add, MAX_DAY)
      .first<{ current_day: number }>()
    if (!row) return refuse('bad_input', `The day cannot go past ${MAX_DAY}`)
  } else if (set !== undefined) {
    if (!isInt(set, 1, MAX_DAY)) return refuse('bad_input', `The day must be a whole number from 1 to ${MAX_DAY}`)
    row = await db.prepare('UPDATE campaign SET current_day = ? WHERE id = ? RETURNING current_day').bind(set, campaignId).first<{ current_day: number }>()
    if (!row) return refuse('not_found', 'No such campaign')
  } else {
    return refuse('bad_input', 'Give either {add} or {set}')
  }
  await changed(env, campaignId)
  return { ok: true, currentDay: row.current_day }
}

// ---- Sessions (spec §2.2) ----------------------------------------------------------------------

type SessionRow = { id: string; number: number; real_date: string; start_day: number; end_day: number | null; recap: string; xp_awards: string }
type EncounterRow = { session_id: string; encounter_id: string; title: string; attached_at: string }

const encounterUrl = (encounterId: string) => `${TOOLS_ORIGIN}/encounter-builder/${encodeURIComponent(encounterId)}`

const toSession = (r: SessionRow, encounters: EncounterRow[], journal: SharedJournalEntry[]): SessionView => ({
  id: r.id,
  number: r.number,
  realDate: r.real_date,
  startDay: r.start_day,
  endDay: r.end_day,
  open: r.end_day === null,
  recap: r.recap,
  xpAwards: JSON.parse(r.xp_awards),
  encounters: encounters.filter((e) => e.session_id === r.id).map((e) => ({ encounterId: e.encounter_id, title: e.title, attachedAt: e.attached_at, url: encounterUrl(e.encounter_id) })),
  journal: journal.filter((j) => j.sessionId === r.id),
})

const todayUtc = () => new Date().toISOString().slice(0, 10)

const isDate = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const ms = Date.parse(`${s}T00:00:00Z`)
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === s // rejects 2026-02-31, which Date rolls over
}

/**
 * The GM starts the next session: number = count + 1, real date today (or the GM's own calendar date), start day =
 * `current_day`. Refused with "End session N first" while one is open. One statement: it inserts only when no session is
 * open, and the unique indexes on (campaign, number) and on the open session settle two starts racing.
 * It does not run the per-character Start session action (spec §2.2).
 */
export async function startSession(
  db: D1Database, env: ChannelEnv, userId: string, campaignId: string, input: StartSessionInput = {},
): Promise<{ ok: true; session: SessionView } | CampaignPlayRefusal> {
  const denied = await gmRefusal(db, userId, campaignId)
  if (denied) return denied
  if (input !== undefined && !isObject(input)) return refuse('bad_input', 'input must be an object')
  const unknown = input && unknownKey(input, ['realDate'], 'Start session')
  if (unknown) return unknown
  const realDate = input?.realDate ?? todayUtc()
  if (!isDate(realDate)) return refuse('bad_input', 'realDate must be a calendar date, YYYY-MM-DD')

  const id = crypto.randomUUID()
  const openSession = async () =>
    refuse('session_open', `End session ${(await db.prepare('SELECT number FROM campaign_session WHERE campaign_id = ? AND end_day IS NULL').bind(campaignId).first<{ number: number }>())?.number} first`)
  let inserted: SessionRow | null
  try {
    inserted = await db
      .prepare(
        `INSERT INTO campaign_session (id, campaign_id, number, real_date, start_day)
         SELECT ?, c.id, (SELECT COUNT(*) + 1 FROM campaign_session WHERE campaign_id = c.id), ?, c.current_day FROM campaign c
          WHERE c.id = ? AND NOT EXISTS (SELECT 1 FROM campaign_session WHERE campaign_id = c.id AND end_day IS NULL)
         RETURNING id, number, real_date, start_day, end_day, recap, xp_awards`,
      )
      .bind(id, realDate, campaignId)
      .first<SessionRow>()
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) return openSession() // lost a race with another start
    throw error
  }
  if (!inserted) return (await db.prepare('SELECT 1 AS v FROM campaign WHERE id = ?').bind(campaignId).first()) ? openSession() : refuse('not_found', 'No such campaign')
  await changed(env, campaignId)
  return { ok: true, session: toSession(inserted, [], []) }
}

/** The GM ends the open session: its end day becomes the campaign's `current_day`. */
export async function endSession(
  db: D1Database, env: ChannelEnv, userId: string, campaignId: string, input: SessionRef,
): Promise<{ ok: true; session: SessionView } | CampaignPlayRefusal> {
  const denied = await gmRefusal(db, userId, campaignId)
  if (denied) return denied
  const bad = badId(input?.sessionId, 'sessionId')
  if (bad) return bad
  const ended = await db
    .prepare(
      `UPDATE campaign_session SET end_day = (SELECT current_day FROM campaign WHERE id = campaign_session.campaign_id)
        WHERE id = ? AND campaign_id = ? AND end_day IS NULL RETURNING id, number, real_date, start_day, end_day, recap, xp_awards`,
    )
    .bind(input.sessionId, campaignId)
    .first<SessionRow>()
  if (!ended) {
    const existing = await db.prepare('SELECT number FROM campaign_session WHERE id = ? AND campaign_id = ?').bind(input.sessionId, campaignId).first<{ number: number }>()
    return existing ? refuse('session_closed', `Session ${existing.number} has already ended`) : refuse('not_found', 'No such session')
  }
  await changed(env, campaignId)
  return { ok: true, session: toSession(ended, [], []) }
}

/** The GM writes or replaces a session's recap (markdown), open or closed. */
export async function editRecap(
  db: D1Database, env: ChannelEnv, userId: string, campaignId: string, input: EditRecapInput,
): Promise<{ ok: true; sessionId: string; recap: string } | CampaignPlayRefusal> {
  const denied = await gmRefusal(db, userId, campaignId)
  if (denied) return denied
  const bad = badId(input?.sessionId, 'sessionId')
  if (bad) return bad
  if (typeof input.recap !== 'string') return refuse('bad_input', 'recap must be a string')
  if (input.recap.length > MAX_RECAP_LENGTH) return refuse('bad_input', `A recap is at most ${MAX_RECAP_LENGTH} characters`)
  const row = await db
    .prepare('UPDATE campaign_session SET recap = ? WHERE id = ? AND campaign_id = ? RETURNING id')
    .bind(input.recap, input.sessionId, campaignId)
    .first<{ id: string }>()
  if (!row) return refuse('not_found', 'No such session')
  await changed(env, campaignId)
  return { ok: true, sessionId: row.id, recap: input.recap }
}

/**
 * The session log for members, newest first, each session with its XP awards, attached encounters and the campaign's shared
 * journal entries written during it (J1's `listSharedJournal`; an unshared entry never reaches this function). Shared entries
 * written with no session open are `betweenSessions`.
 */
export async function listSessions(db: D1Database, userId: string, campaignId: string): Promise<SessionList | CampaignPlayRefusal> {
  const denied = await memberRefusal(db, userId, campaignId)
  if (denied) return denied
  const [{ results: sessions }, { results: encounters }, shared] = await Promise.all([
    db
      .prepare('SELECT id, number, real_date, start_day, end_day, recap, xp_awards FROM campaign_session WHERE campaign_id = ? ORDER BY number DESC')
      .bind(campaignId)
      .all<SessionRow>(),
    db
      .prepare(
        `SELECT e.session_id, e.encounter_id, e.title, e.attached_at FROM session_encounter e JOIN campaign_session s ON s.id = e.session_id
          WHERE s.campaign_id = ? ORDER BY e.attached_at, e.encounter_id`,
      )
      .bind(campaignId)
      .all<EncounterRow>(),
    listSharedJournal(db, userId, { campaignId }),
  ])
  if (!shared.ok) throw new Error(`listSharedJournal refused a member of ${campaignId}: ${shared.code}`)
  return {
    ok: true,
    sessions: sessions.map((s) => toSession(s, encounters, shared.entries)),
    betweenSessions: shared.entries.filter((j) => j.sessionId === null),
  }
}

// ---- Encounters (spec §7.3) --------------------------------------------------------------------

/**
 * The GM attaches a tools encounter to a session of the campaign. The row stores the encounter's id and title; the page is
 * `TOOLS_ORIGIN/encounter-builder/<id>`. Attaching the same encounter to the same session again renames it. Tools reaches
 * this over the service binding with the signed-in user's id, so a non-GM is refused here.
 */
export async function attachEncounter(
  db: D1Database, env: ChannelEnv, userId: string, campaignId: string, sessionId: string, input: AttachEncounterInput,
): Promise<{ ok: true; encounter: SessionEncounter } | CampaignPlayRefusal> {
  const denied = await gmRefusal(db, userId, campaignId)
  if (denied) return denied
  const bad = badId(sessionId, 'sessionId') ?? badId(input?.encounterId, 'encounterId')
  if (bad) return bad
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title || title.length > MAX_TEXT_LENGTH) return refuse('bad_input', `An encounter title is 1 to ${MAX_TEXT_LENGTH} characters`)
  if (input.encounterId.length > MAX_TEXT_LENGTH) return refuse('bad_input', 'encounterId is too long')
  const row = await db
    .prepare(
      `INSERT INTO session_encounter (session_id, encounter_id, title)
       SELECT id, ?, ? FROM campaign_session WHERE id = ? AND campaign_id = ?
       ON CONFLICT (session_id, encounter_id) DO UPDATE SET title = excluded.title
       RETURNING encounter_id, title, attached_at`,
    )
    .bind(input.encounterId, title, sessionId, campaignId)
    .first<{ encounter_id: string; title: string; attached_at: string }>()
  if (!row) return refuse('not_found', 'No such session')
  await changed(env, campaignId)
  return { ok: true, encounter: { encounterId: row.encounter_id, title: row.title, attachedAt: row.attached_at, url: encounterUrl(row.encounter_id) } }
}

/** The GM removes an encounter from a session. The encounter itself stays on tools. */
export async function removeEncounter(
  db: D1Database, env: ChannelEnv, userId: string, campaignId: string, sessionId: string, input: RemoveEncounterInput,
): Promise<{ ok: true } | CampaignPlayRefusal> {
  const denied = await gmRefusal(db, userId, campaignId)
  if (denied) return denied
  const bad = badId(sessionId, 'sessionId') ?? badId(input?.encounterId, 'encounterId')
  if (bad) return bad
  const result = await db
    .prepare('DELETE FROM session_encounter WHERE session_id = ? AND encounter_id = ? AND session_id IN (SELECT id FROM campaign_session WHERE campaign_id = ?)')
    .bind(sessionId, input.encounterId, campaignId)
    .run()
  if (result.meta.changes !== 1) return refuse('not_found', 'No such attached encounter')
  await changed(env, campaignId)
  return { ok: true }
}

// ---- Stratagems (spec §2.3) --------------------------------------------------------------------

type StratagemRow = {
  id: string; goal: string; time_per_roll: string; setup_cn: number; status: StratagemStatus; position: number
  objectives: string; assets: string; created_at: string
}

const STRATAGEM_COLUMNS = 'id, goal, time_per_roll, setup_cn, status, position, objectives, assets, created_at'
const CREATE_KEYS = ['goal', 'timePerRoll', 'setupCn', 'objectives', 'assets', 'status'] as const
const OBJECTIVE_KEYS = ['title', 'cn', 'leaderCharacterId', 'state'] as const
const ASSET_KEYS = ['name', 'kind'] as const
const STATES: readonly ObjectiveState[] = ['open', 'done', 'gone']
const KINDS: readonly AssetKind[] = ['asset', 'hindrance']
const STATUSES: readonly StratagemStatus[] = ['active', 'finished', 'abandoned']

const text = (v: unknown, what: string, required: boolean): string | CampaignPlayRefusal => {
  if (typeof v !== 'string') return refuse('bad_input', `${what} must be a string`)
  const t = v.trim()
  if (required && !t) return refuse('bad_input', `${what} is required`)
  return t.length > MAX_TEXT_LENGTH ? refuse('bad_input', `${what} is at most ${MAX_TEXT_LENGTH} characters`) : t
}

/** Validates an objective list; a leader must be a character in this campaign. */
async function checkObjectives(db: D1Database, campaignId: string, v: unknown): Promise<ObjectiveInput[] | CampaignPlayRefusal> {
  if (!Array.isArray(v) || v.length > MAX_OBJECTIVES) return refuse('bad_input', `objectives must be a list of at most ${MAX_OBJECTIVES}`)
  const out: ObjectiveInput[] = []
  for (const o of v) {
    if (!isObject(o)) return refuse('bad_input', 'An objective must be an object')
    const extra = unknownKey(o, OBJECTIVE_KEYS, 'An objective')
    if (extra) return extra
    const title = text(o.title, 'An objective title', false) // blank is an unrevealed slot
    if (typeof title !== 'string') return title
    if (o.cn !== null && !isInt(o.cn, -MAX_CN, MAX_CN)) return refuse('bad_input', 'An objective CN is a whole number or null')
    if (o.leaderCharacterId !== null && typeof o.leaderCharacterId !== 'string') return refuse('bad_input', 'leaderCharacterId is a character id or null')
    if (!STATES.includes(o.state as ObjectiveState)) return refuse('bad_input', 'An objective state is open, done or gone')
    out.push({ title, cn: o.cn as number | null, leaderCharacterId: o.leaderCharacterId as string | null, state: o.state as ObjectiveState })
  }
  const leaders = [...new Set(out.flatMap((o) => (o.leaderCharacterId === null ? [] : [o.leaderCharacterId])))]
  if (leaders.length > 0) {
    const { results } = await db
      .prepare(`SELECT id FROM character WHERE campaign_id = ? AND id IN (${leaders.map(() => '?').join(',')})`)
      .bind(campaignId, ...leaders)
      .all<{ id: string }>()
    const missing = leaders.find((id) => !results.some((r) => r.id === id))
    if (missing !== undefined) return refuse('bad_input', 'An objective leader must be a character in this campaign')
  }
  return out
}

function checkAssets(v: unknown): AssetInput[] | CampaignPlayRefusal {
  if (!Array.isArray(v) || v.length > MAX_ASSETS) return refuse('bad_input', `assets must be a list of at most ${MAX_ASSETS}`)
  const out: AssetInput[] = []
  for (const a of v) {
    if (!isObject(a)) return refuse('bad_input', 'An asset must be an object')
    const extra = unknownKey(a, ASSET_KEYS, 'An asset')
    if (extra) return extra
    const name = text(a.name, 'An asset name', true)
    if (typeof name !== 'string') return name
    if (!KINDS.includes(a.kind as AssetKind)) return refuse('bad_input', 'An asset kind is asset or hindrance')
    out.push({ name, kind: a.kind as AssetKind })
  }
  return out
}

/** The validated, normalised fields of a create or update; only the keys present in `input` come back. */
type StratagemFields = { goal?: string; timePerRoll?: string; setupCn?: number; objectives?: ObjectiveInput[]; assets?: AssetInput[]; status?: StratagemStatus }

async function checkFields(db: D1Database, campaignId: string, input: Record<string, unknown>): Promise<StratagemFields | CampaignPlayRefusal> {
  const out: StratagemFields = {}
  if ('goal' in input) {
    const goal = text(input.goal, 'The goal', true)
    if (typeof goal !== 'string') return goal
    out.goal = goal
  }
  if ('timePerRoll' in input) {
    const time = text(input.timePerRoll, 'Time per roll', false)
    if (typeof time !== 'string') return time
    out.timePerRoll = time
  }
  if ('setupCn' in input) {
    if (!isInt(input.setupCn, -MAX_CN, MAX_CN)) return refuse('bad_input', 'The setup CN must be a whole number')
    out.setupCn = input.setupCn
  }
  if ('objectives' in input) {
    const objectives = await checkObjectives(db, campaignId, input.objectives)
    if (!Array.isArray(objectives)) return objectives
    out.objectives = objectives
  }
  if ('assets' in input) {
    const assets = checkAssets(input.assets)
    if (!Array.isArray(assets)) return assets
    out.assets = assets
  }
  if ('status' in input) {
    if (!STATUSES.includes(input.status as StratagemStatus)) return refuse('bad_input', 'A status is active, finished or abandoned')
    out.status = input.status as StratagemStatus
  }
  return out
}

/**
 * The current CN of each open objective comes from the engine's `objectiveCn` (spec §2.3: own CN or setup CN, −3 per asset,
 * +3 per hindrance, no floor or ceiling), the same function the roll server calls when an objective is rolled.
 */
function toView(row: StratagemRow, leaderNames: Map<string, string>): StratagemView {
  const stored = JSON.parse(row.objectives) as ObjectiveInput[]
  const assets = JSON.parse(row.assets) as AssetInput[]
  const stratagem: Stratagem = {
    goal: row.goal,
    timePerRoll: row.time_per_roll,
    setupCn: row.setup_cn,
    status: row.status,
    position: row.position,
    objectives: stored.map((o) => ({ title: o.title, cn: o.cn, leader: o.leaderCharacterId, state: o.state })),
    assets,
  }
  return {
    id: row.id,
    goal: row.goal,
    timePerRoll: row.time_per_roll,
    setupCn: row.setup_cn,
    status: row.status,
    position: row.position,
    objectives: stored.map((o, i) => ({
      ...o,
      leaderName: o.leaderCharacterId === null ? null : (leaderNames.get(o.leaderCharacterId) ?? null),
      currentCn: o.state === 'open' ? objectiveCn(stratagem, i) : null,
    })),
    assets,
    createdAt: row.created_at,
  }
}

async function viewsOf(db: D1Database, campaignId: string, rows: StratagemRow[]): Promise<StratagemView[]> {
  const { results } = await db.prepare('SELECT id, name FROM character WHERE campaign_id = ?').bind(campaignId).all<{ id: string; name: string }>()
  const names = new Map(results.map((r) => [r.id, r.name]))
  return rows.map((r) => toView(r, names))
}

/** The GM creates a stratagem at the end of the list. Status defaults to `active`. */
export async function createStratagem(
  db: D1Database, env: ChannelEnv, userId: string, campaignId: string, input: CreateStratagemInput,
): Promise<{ ok: true; stratagem: StratagemView } | CampaignPlayRefusal> {
  const denied = await gmRefusal(db, userId, campaignId)
  if (denied) return denied
  if (!isObject(input)) return refuse('bad_input', 'input must be an object')
  const extra = unknownKey(input, CREATE_KEYS, 'A stratagem')
  if (extra) return extra
  for (const required of ['goal', 'timePerRoll', 'setupCn'] as const) if (!(required in input)) return refuse('bad_input', `${required} is required`)
  const fields = await checkFields(db, campaignId, input)
  if ('ok' in fields) return fields
  const row = await db
    .prepare(
      `INSERT INTO stratagem (id, campaign_id, goal, time_per_roll, setup_cn, status, position, objectives, assets)
       SELECT ?, c.id, ?, ?, ?, ?, (SELECT COALESCE(MAX(position) + 1, 0) FROM stratagem WHERE campaign_id = c.id), ?, ? FROM campaign c WHERE c.id = ?
       RETURNING ${STRATAGEM_COLUMNS}`,
    )
    .bind(crypto.randomUUID(), fields.goal, fields.timePerRoll, fields.setupCn, fields.status ?? 'active', JSON.stringify(fields.objectives ?? []), JSON.stringify(fields.assets ?? []), campaignId)
    .first<StratagemRow>()
  if (!row) return refuse('not_found', 'No such campaign')
  await changed(env, campaignId)
  return { ok: true, stratagem: (await viewsOf(db, campaignId, [row]))[0] }
}

/**
 * The GM changes any of a stratagem's fields: goal, time per roll, setup CN, the whole objective list (titles, CNs, leaders,
 * done/gone), the whole asset/hindrance list, status, position. Only the keys given change. A player is refused for every field.
 * `position` sorts the list; it does not renumber the others.
 */
export async function updateStratagem(
  db: D1Database, env: ChannelEnv, userId: string, campaignId: string, input: UpdateStratagemInput,
): Promise<{ ok: true; stratagem: StratagemView } | CampaignPlayRefusal> {
  const denied = await gmRefusal(db, userId, campaignId)
  if (denied) return denied
  if (!isObject(input)) return refuse('bad_input', 'input must be an object')
  const bad = badId(input.stratagemId, 'stratagemId')
  if (bad) return bad
  const { stratagemId, ...patch } = input
  const extra = unknownKey(patch, [...CREATE_KEYS, 'position'], 'A stratagem')
  if (extra) return extra
  if (Object.keys(patch).length === 0) return refuse('bad_input', 'Nothing to change')
  const fields = await checkFields(db, campaignId, patch)
  if ('ok' in fields) return fields
  const sets: string[] = []
  const values: unknown[] = []
  const set = (column: string, value: unknown) => { sets.push(`${column} = ?`); values.push(value) }
  if (fields.goal !== undefined) set('goal', fields.goal)
  if (fields.timePerRoll !== undefined) set('time_per_roll', fields.timePerRoll)
  if (fields.setupCn !== undefined) set('setup_cn', fields.setupCn)
  if (fields.objectives !== undefined) set('objectives', JSON.stringify(fields.objectives))
  if (fields.assets !== undefined) set('assets', JSON.stringify(fields.assets))
  if (fields.status !== undefined) set('status', fields.status)
  if ('position' in patch) {
    if (!isInt(patch.position, 0, 1_000_000)) return refuse('bad_input', 'position must be a whole number')
    set('position', patch.position)
  }
  const row = await db
    .prepare(`UPDATE stratagem SET ${sets.join(', ')} WHERE id = ? AND campaign_id = ? RETURNING ${STRATAGEM_COLUMNS}`)
    .bind(...values, stratagemId, campaignId)
    .first<StratagemRow>()
  if (!row) return refuse('not_found', 'No such stratagem')
  await changed(env, campaignId)
  return { ok: true, stratagem: (await viewsOf(db, campaignId, [row]))[0] }
}

/** Every stratagem of the campaign for its members, in position order, each open objective with its current CN. */
export async function listStratagems(db: D1Database, userId: string, campaignId: string): Promise<{ ok: true; stratagems: StratagemView[] } | CampaignPlayRefusal> {
  const denied = await memberRefusal(db, userId, campaignId)
  if (denied) return denied
  const { results } = await db
    .prepare(`SELECT ${STRATAGEM_COLUMNS} FROM stratagem WHERE campaign_id = ? ORDER BY position, created_at, id`)
    .bind(campaignId)
    .all<StratagemRow>()
  return { ok: true, stratagems: await viewsOf(db, campaignId, results) }
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

export const setDayFn = createServerFn({ method: 'POST' })
  .validator(input<{ campaignId: string } & SetDayInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const { campaignId, ...day } = data
    return setDay(db, env, userId, campaignId, day as SetDayInput)
  })

export const startSessionFn = createServerFn({ method: 'POST' })
  .validator(input<{ campaignId: string } & StartSessionInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const { campaignId, ...rest } = data
    return startSession(db, env, userId, campaignId, rest)
  })

export const endSessionFn = createServerFn({ method: 'POST' })
  .validator(input<{ campaignId: string } & SessionRef>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    return endSession(db, env, userId, data.campaignId, { sessionId: data.sessionId })
  })

export const editRecapFn = createServerFn({ method: 'POST' })
  .validator(input<{ campaignId: string } & EditRecapInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    return editRecap(db, env, userId, data.campaignId, { sessionId: data.sessionId, recap: data.recap })
  })

export const listSessionsFn = createServerFn({ method: 'GET' })
  .validator(input<{ campaignId: string }>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return listSessions(db, userId, data.campaignId)
  })

export const attachEncounterFn = createServerFn({ method: 'POST' })
  .validator(input<{ campaignId: string; sessionId: string } & AttachEncounterInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    return attachEncounter(db, env, userId, data.campaignId, data.sessionId, { encounterId: data.encounterId, title: data.title })
  })

export const removeEncounterFn = createServerFn({ method: 'POST' })
  .validator(input<{ campaignId: string; sessionId: string } & RemoveEncounterInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    return removeEncounter(db, env, userId, data.campaignId, data.sessionId, { encounterId: data.encounterId })
  })

export const createStratagemFn = createServerFn({ method: 'POST' })
  .validator(input<{ campaignId: string } & CreateStratagemInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const { campaignId, ...rest } = data
    return createStratagem(db, env, userId, campaignId, rest)
  })

export const updateStratagemFn = createServerFn({ method: 'POST' })
  .validator(input<{ campaignId: string } & UpdateStratagemInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const { campaignId, ...rest } = data
    return updateStratagem(db, env, userId, campaignId, rest)
  })

export const listStratagemsFn = createServerFn({ method: 'GET' })
  .validator(input<{ campaignId: string }>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return listStratagems(db, userId, data.campaignId)
  })
