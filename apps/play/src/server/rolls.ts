// The roll server (campaign spec §3 server half, plan ruling 24): every roll is made here with a crypto-backed `rand`, never
// in the browser, so a roll in the feed is the roll that happened.
//
// Same shape as `characters.ts` and `journal.ts` (ruling 22): plain `(db, env, userId, input) → result` functions hold all the
// logic and the tests call them; the `createServerFn` wrappers at the bottom resolve the signed-in user and `env`. Expected
// refusals are values, `{ok: false, status, code, message}`; infrastructure failures throw.
//
// Rolling never writes `character` or `character_event` (spec criterion 14): a roll is not character state, so INV-ACTION does
// not apply. A character in a campaign has its roll stored in `roll` and published to the campaign's channel (INV-LIVE, best
// effort, after the write commits). A character in no campaign stores nothing.
//
// Completion protocol (ruling 24). A check with exactly one kept 1 is stored with `complication = 'pending'`; its roller then
// picks once between Fail and Reroll-and-take-a-complication (`resolveComplication`). Two or more kept 1s are stored as
// `double` (automatic failure plus a complication, nothing to choose). `resolveComplication` is the only change a roll row
// ever gets, and it is one conditional UPDATE, so two concurrent resolutions cannot both win.
import { createServerFn } from '@tanstack/react-start'
import { monotonicFactory } from 'ulid'
import { rerollComplication, roll as rollDice, rollSpec, type RandomDie, type RolledDie, type RollResult, type RollType } from '@heartrush/rules-engine/dice'
import { objectiveCn, type Stratagem } from '@heartrush/rules-engine/stratagem'
import { upgradeCharacter } from '@heartrush/rules-engine/actions'
import { RuleError, type AbilityId } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../catalogue'
import { characterRole, mayWrite, roleIn } from './authz'
import { publish, type LiveRoll } from './live'

// ---- Types -------------------------------------------------------------------------------------

export type RollErrorCode = 'forbidden' | 'not_found' | 'bad_input' | 'bad_roll' | 'is_draft' | 'already_resolved' | 'in_campaign'

/** An expected refusal. */
export type RollRefusal = { ok: false; status: number; code: RollErrorCode; message: string }

/** `pending`: one kept 1, no choice yet. `double`: two or more kept 1s. */
export type Complication = 'none' | 'pending' | 'failed' | 'rerolled' | 'double'

/** The roll an in-memory result describes, with the stored complication vocabulary. */
export type RollView = Omit<RollResult, 'complication'> & { complication: Complication }

/** A stored roll as the feed shows it. */
export type RollRecord = {
  id: string
  campaignId: string
  characterId: string
  characterName: string
  /** The user who rolled (the player, or the GM rolling for a player's character). */
  userId: string
  playerName: string
  rollType: RollType
  ability: AbilityId
  /** Every die rolled, dropped ones included (`dropped`), and the replaced value of a rerolled die (`rerolled`). */
  dice: RolledDie[]
  modifier: number
  total: number
  complication: Complication
  /** Set for a stratagem objective roll. `label` is "<goal> — <objective title>"; null when the stratagem or objective is gone. */
  objective: { stratagemId: string; index: number; cn: number; label: string | null } | null
  createdAt: string
}

export type RollInput = {
  characterId: string
  type: RollType
  ability: AbilityId
  modifier: number
  /** Advantage (positive) or disadvantage (negative) dice, after cancelling. */
  net: number
  objective?: { stratagemId: string; index: number }
}
export type RollOk = { ok: true; result: RollView; roll: RollRecord | null }
export type ResolveOk = { ok: true; roll: RollRecord }
export type RerollDieInput = { characterId: string; sides: number }
export type ListRollsInput = { campaignId: string }

type PublishEnv = Parameters<typeof publish>[0]

// ---- Helpers -----------------------------------------------------------------------------------

const STATUS: Record<RollErrorCode, number> = { forbidden: 403, not_found: 404, bad_input: 400, bad_roll: 400, is_draft: 409, already_resolved: 409, in_campaign: 409 }
const refuse = (code: RollErrorCode, message: string): RollRefusal => ({ ok: false, status: STATUS[code], code, message })
const isRefusal = (v: unknown): v is RollRefusal => typeof v === 'object' && v !== null && (v as { ok?: unknown }).ok === false

/** The newest rolls a campaign keeps. */
export const ROLL_LIMIT = 200
/** Bounds on what a client may ask for, so one request cannot roll an unbounded number of dice. */
export const MAX_NET = 10
export const MAX_MODIFIER = 1000

/** Unbiased `1..sides` from `crypto.getRandomValues` (rejection sampling). */
export const cryptoRand: RandomDie = (sides) => {
  const limit = Math.floor(0x1_0000_0000 / sides) * sides
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0]! >= limit)
  return (buf[0]! % sides) + 1
}

/** Ids that increase within a millisecond, so "newest first" and "beyond the newest 200" agree with insertion order. */
const newRollId = monotonicFactory()

const badId = (id: unknown, what: string): RollRefusal | null =>
  typeof id === 'string' && id ? null : refuse('bad_input', `${what} must be a non-empty string`)

const ROLL_TYPES: readonly string[] = ['check', 'save', 'attack', 'defense']
const ABILITIES: readonly string[] = ['might', 'agility', 'cunning', 'presence']

function badRollInput(input: RollInput): RollRefusal | null {
  const bad = badId(input?.characterId, 'characterId')
  if (bad) return bad
  if (!ROLL_TYPES.includes(input.type)) return refuse('bad_roll', 'type must be check, save, attack or defense')
  if (!ABILITIES.includes(input.ability)) return refuse('bad_roll', 'ability must be might, agility, cunning or presence')
  if (!Number.isSafeInteger(input.modifier) || Math.abs(input.modifier) > MAX_MODIFIER) return refuse('bad_input', `modifier must be a whole number within ±${MAX_MODIFIER}`)
  if (!Number.isSafeInteger(input.net) || Math.abs(input.net) > MAX_NET) return refuse('bad_input', `net must be a whole number within ±${MAX_NET}`)
  if (input.objective !== undefined) {
    const o = input.objective
    if (typeof o !== 'object' || o === null || badId(o.stratagemId, 'stratagemId') || !Number.isSafeInteger(o.index) || o.index < 0) return refuse('bad_input', 'objective needs a stratagemId and an index')
    if (input.type !== 'check') return refuse('bad_input', 'A stratagem objective is rolled as a skill check')
  }
  return null
}

type CharacterRow = { id: string; owner_user_id: string; campaign_id: string | null; name: string; state: string }

async function loadCharacter(db: D1Database, characterId: string): Promise<CharacterRow | null> {
  return db.prepare('SELECT id, owner_user_id, campaign_id, name, state FROM character WHERE id = ?').bind(characterId).first<CharacterRow>()
}

const isDraft = (row: CharacterRow): boolean => (JSON.parse(row.state) as { draft?: unknown }).draft === true

/** The character's role when the user may edit its sheet (its owner, or its campaign's GM), else a refusal. */
async function writableRole(db: D1Database, userId: string, row: CharacterRow) {
  const role = await characterRole(db, userId, { ownerUserId: row.owner_user_id, campaignId: row.campaign_id, draft: isDraft(row) })
  if (!mayWrite(role)) return refuse('forbidden', 'You cannot roll for this character')
  return role!
}

type StratagemRow = { id: string; campaign_id: string; goal: string; time_per_roll: string; setup_cn: number; status: Stratagem['status']; position: number; objectives: string; assets: string }
type StoredObjective = { title: string; cn: number | null; leaderCharacterId: string | null; state: 'open' | 'done' | 'gone' }

const toStratagem = (s: StratagemRow): { stratagem: Stratagem; objectives: StoredObjective[] } => {
  const objectives = JSON.parse(s.objectives) as StoredObjective[]
  return {
    objectives,
    stratagem: {
      goal: s.goal,
      timePerRoll: s.time_per_roll,
      setupCn: s.setup_cn,
      status: s.status,
      position: s.position,
      objectives: objectives.map((o) => ({ title: o.title, cn: o.cn, leader: o.leaderCharacterId, state: o.state })),
      assets: JSON.parse(s.assets),
    },
  }
}

const objectiveLabel = (goal: string, title: string): string => `${goal} — ${title.trim() || 'Unknown objective'}`

type RollRow = {
  id: string; campaign_id: string; character_id: string; user_id: string; roll_type: RollType; ability: AbilityId; dice: string
  modifier: number; total: number; complication: Complication; objective_stratagem_id: string | null; objective_index: number | null
  objective_cn: number | null; created_at: string; character_name: string; player_name: string; goal: string | null; objectives: string | null
}

const ROLL_SELECT =
  `SELECT r.*, c.name AS character_name, u.display_name AS player_name, s.goal AS goal, s.objectives AS objectives
     FROM roll r JOIN character c ON c.id = r.character_id JOIN user u ON u.id = r.user_id LEFT JOIN stratagem s ON s.id = r.objective_stratagem_id`

function toRecord(r: RollRow): RollRecord {
  let objective: RollRecord['objective'] = null
  if (r.objective_stratagem_id !== null && r.objective_index !== null && r.objective_cn !== null) {
    const title = r.objectives === null ? undefined : (JSON.parse(r.objectives) as StoredObjective[])[r.objective_index]?.title
    objective = { stratagemId: r.objective_stratagem_id, index: r.objective_index, cn: r.objective_cn, label: r.goal === null || title === undefined ? null : objectiveLabel(r.goal, title) }
  }
  return {
    id: r.id, campaignId: r.campaign_id, characterId: r.character_id, characterName: r.character_name, userId: r.user_id, playerName: r.player_name,
    rollType: r.roll_type, ability: r.ability, dice: JSON.parse(r.dice), modifier: r.modifier, total: r.total, complication: r.complication, objective, createdAt: r.created_at,
  }
}

async function loadRecord(db: D1Database, rollId: string): Promise<RollRecord | null> {
  const row = await db.prepare(`${ROLL_SELECT} WHERE r.id = ?`).bind(rollId).first<RollRow>()
  return row ? toRecord(row) : null
}

/** The engine reports two kept 1s as `failed` with `automaticFailure`; storage keeps that apart from a chosen Fail. */
const storedComplication = (r: RollResult): Complication => (r.automaticFailure ? 'double' : r.complication)

const asLive = (roll: RollRecord): LiveRoll => roll

// ---- Operations --------------------------------------------------------------------------------

/**
 * Makes one roll for a character the user may edit. With `objective`, the user must own the character, the character must
 * lead that open objective of one of its campaign's stratagems, and the roll carries the objective's current CN.
 * A character in a campaign: inserts the `roll` row and deletes the campaign's rows beyond the newest 200 in one batch, then
 * publishes `{type: 'roll', roll}`. A character in no campaign: nothing is stored or published (`roll` is null).
 * `rand` is injectable for tests; the server functions always use the crypto-backed one.
 */
export async function rollForCharacter(
  db: D1Database, env: PublishEnv, userId: string, input: RollInput, rand: RandomDie = cryptoRand,
): Promise<RollOk | RollRefusal> {
  const invalid = badRollInput(input)
  if (invalid) return invalid
  const row = await loadCharacter(db, input.characterId)
  if (!row) return refuse('not_found', 'No such character')
  const role = await writableRole(db, userId, row)
  if (isRefusal(role)) return role
  if (isDraft(row)) return refuse('is_draft', 'A character still in the builder cannot roll')

  let objective: { stratagemId: string; index: number; cn: number } | null = null
  if (input.objective) {
    if (role !== 'owner') return refuse('forbidden', 'Only the character\'s player rolls its objective')
    if (row.campaign_id === null) return refuse('forbidden', 'This character is in no campaign')
    const found = await db.prepare('SELECT * FROM stratagem WHERE id = ? AND campaign_id = ?').bind(input.objective.stratagemId, row.campaign_id).first<StratagemRow>()
    if (!found) return refuse('not_found', 'No such stratagem in this character\'s campaign')
    const { stratagem, objectives } = toStratagem(found)
    const target = objectives[input.objective.index]
    if (!target) return refuse('bad_input', 'No such objective')
    if (target.leaderCharacterId !== row.id) return refuse('forbidden', 'This character does not lead that objective')
    if (target.state !== 'open') return refuse('forbidden', 'That objective is not open')
    objective = { stratagemId: found.id, index: input.objective.index, cn: objectiveCn(stratagem, input.objective.index) }
  }

  let result: RollResult
  try {
    const character = upgradeCharacter(JSON.parse(row.state))
    if (character.draft) return refuse('is_draft', 'A character still in the builder cannot roll')
    const spec = rollSpec(character, { type: input.type, ability: input.ability }, getCatalogue().conditions)
    result = rollDice(spec, { modifier: input.modifier, net: input.net }, rand)
  } catch (error) {
    if (error instanceof RuleError && error.code === 'bad_roll') return refuse('bad_roll', error.message)
    throw error
  }
  const view: RollView = { ...result, complication: storedComplication(result) }
  if (row.campaign_id === null) return { ok: true, result: view, roll: null }

  const id = newRollId()
  await db.batch([
    db
      .prepare(
        `INSERT INTO roll (id, campaign_id, character_id, user_id, roll_type, ability, dice, modifier, total, complication,
                           objective_stratagem_id, objective_index, objective_cn, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, row.campaign_id, row.id, userId, input.type, input.ability, JSON.stringify(result.dice), input.modifier, result.total, view.complication,
        objective?.stratagemId ?? null, objective?.index ?? null, objective?.cn ?? null, new Date().toISOString(),
      ),
    db
      .prepare(`DELETE FROM roll WHERE campaign_id = ? AND id NOT IN (SELECT id FROM roll WHERE campaign_id = ? ORDER BY created_at DESC, id DESC LIMIT ${ROLL_LIMIT})`)
      .bind(row.campaign_id, row.campaign_id),
  ])
  const record = await loadRecord(db, id)
  if (!record) throw new Error('roll insert committed but the row is missing')
  await publish(env, row.campaign_id, { type: 'roll', roll: asLive(record) })
  return { ok: true, result: view, roll: record }
}

/**
 * The roller's one choice on a `pending` roll. `fail` keeps the dice and marks the roll `failed`; `reroll` rerolls the one kept 1
 * (the server draws it), marks the roll `rerolled` and updates the total. Roller only, once: the UPDATE matches only
 * `complication = 'pending'`, so a second call, a `double` roll or a concurrent winner is refused. Publishes the completed roll.
 */
export async function resolveComplication(
  db: D1Database, env: PublishEnv, userId: string, rollId: string, choice: 'fail' | 'reroll', rand: RandomDie = cryptoRand,
): Promise<ResolveOk | RollRefusal> {
  const bad = badId(rollId, 'rollId')
  if (bad) return bad
  if (choice !== 'fail' && choice !== 'reroll') return refuse('bad_input', 'choice must be fail or reroll')
  const row = await db.prepare('SELECT * FROM roll WHERE id = ?').bind(rollId).first<RollRow>()
  if (!row) return refuse('not_found', 'No such roll')
  if (row.user_id !== userId) return refuse('forbidden', 'Only the roller completes a roll')
  if (row.complication !== 'pending') return refuse('already_resolved', 'This roll has no choice open')

  let complication: Complication = 'failed'
  let dice = row.dice
  let total = row.total
  if (choice === 'reroll') {
    const rerolled = rerollComplication(
      { type: row.roll_type, ability: row.ability, dice: JSON.parse(row.dice), flat: 0, modifier: row.modifier, net: 0, total: row.total, complication: 'pending', automaticFailure: false },
      rand,
    )
    complication = 'rerolled'
    dice = JSON.stringify(rerolled.dice)
    total = rerolled.total
  }
  const changed = await db
    .prepare("UPDATE roll SET complication = ?, dice = ?, total = ? WHERE id = ? AND user_id = ? AND complication = 'pending'")
    .bind(complication, dice, total, rollId, userId)
    .run()
  if (changed.meta.changes === 0) return refuse('already_resolved', 'This roll has no choice open')
  const record = await loadRecord(db, rollId)
  if (!record) throw new Error('roll update committed but the row is missing')
  await publish(env, record.campaignId, { type: 'roll', roll: asLive(record) })
  return { ok: true, roll: record }
}

/**
 * The reroll of a kept 1 for a character in no campaign, whose roll is stored nowhere (ruling 24). Returns one crypto-random
 * value for a die with `sides` faces; the client replaces the kept 1 with it. Refused for a character in a campaign, whose
 * reroll must go through `resolveComplication`.
 */
export async function rerollDie(
  db: D1Database, userId: string, input: RerollDieInput, rand: RandomDie = cryptoRand,
): Promise<{ ok: true; value: number } | RollRefusal> {
  const bad = badId(input?.characterId, 'characterId')
  if (bad) return bad
  if (!Number.isSafeInteger(input.sides) || input.sides < 4 || input.sides > 20) return refuse('bad_input', 'sides must be a whole number from 4 to 20')
  const row = await loadCharacter(db, input.characterId)
  if (!row) return refuse('not_found', 'No such character')
  const role = await writableRole(db, userId, row)
  if (isRefusal(role)) return role
  if (row.campaign_id !== null) return refuse('in_campaign', 'A campaign roll is completed with resolveComplication')
  return { ok: true, value: rand(input.sides) }
}

/** The campaign's stored rolls, newest first, at most 200. Members only. */
export async function listRolls(db: D1Database, userId: string, input: ListRollsInput): Promise<{ ok: true; rolls: RollRecord[] } | RollRefusal> {
  const bad = badId(input?.campaignId, 'campaignId')
  if (bad) return bad
  if ((await roleIn(db, input.campaignId, userId)) === null) return refuse('forbidden', 'You are not in this campaign')
  const { results } = await db
    .prepare(`${ROLL_SELECT} WHERE r.campaign_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT ${ROLL_LIMIT}`)
    .bind(input.campaignId)
    .all<RollRow>()
  return { ok: true, rolls: results.map(toRecord) }
}

// ---- Server functions (ruling 22) -----------------------------------------------------------------
// Thin wrappers: resolve the signed-in user (INV-AUTHZ) and pass `env.DB`. The imports are dynamic so the plain functions
// above load under node for the tests, where `cloudflare:workers` does not exist.

async function context() {
  const [{ requireUser }, { env }] = await Promise.all([import('./session'), import('cloudflare:workers')])
  const { userId } = await requireUser()
  return { env, db: env.DB, userId }
}

const input = <T>() => (data: unknown) => data as T

export const rollForCharacterFn = createServerFn({ method: 'POST' })
  .validator(input<RollInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    return rollForCharacter(db, env, userId, data)
  })

export const resolveComplicationFn = createServerFn({ method: 'POST' })
  .validator(input<{ rollId: string; choice: 'fail' | 'reroll' }>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    return resolveComplication(db, env, userId, data.rollId, data.choice)
  })

export const rerollDieFn = createServerFn({ method: 'POST' })
  .validator(input<RerollDieInput>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return rerollDie(db, userId, data)
  })

export const listRollsFn = createServerFn({ method: 'GET' })
  .validator(input<ListRollsInput>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return listRolls(db, userId, data)
  })
