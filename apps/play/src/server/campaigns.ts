// The campaign store: campaigns, membership, invites, which characters are in a campaign, and Award XP.
//
// Same shape as `characters.ts` (ruling 22): plain `(db, userId, input) → result` functions hold all the logic and the
// tests call them; the `createServerFn` wrappers at the bottom resolve the signed-in user and `env`, then publish
// (INV-LIVE). Expected refusals are values, `{ok: false, status, code, message}`; infrastructure failures throw.
//
// INV-AUTHZ: every function resolves its own role check against `campaign_member` / `character.owner_user_id`; nothing the
// browser sends about roles is trusted. INV-ACTION: this module never writes `character.state` or `character_event`
// itself; Award XP goes through `applyCharacterAction`. Joining or leaving a campaign changes `character.campaign_id`, which
// is not character state, so it moves no revision and adds no event.
import { createServerFn } from '@tanstack/react-start'
import { effectiveMaxHp, maxHeartDie } from '@heartrush/rules-engine/derived'
import { upgradeCharacter } from '@heartrush/rules-engine/actions'
import type { HeartDie } from '@heartrush/rules-engine/types'
import { ulid } from 'ulid'
import { getCatalogue } from '../catalogue'
import { roleIn, type CampaignRole } from './authz'
import { applyCharacterAction } from './characters'
import { publish } from './live'

// ---- Types -------------------------------------------------------------------------------------

export type CampaignErrorCode =
  | 'forbidden' | 'not_found' | 'bad_input' | 'invite_expired' | 'is_draft' | 'already_in_campaign' | 'not_in_campaign'

/** An expected refusal. */
export type CampaignRefusal = { ok: false; status: number; code: CampaignErrorCode; message: string }

export type CampaignSummary = { id: string; name: string; role: CampaignRole; currentDay: number; memberCount: number }

export type MemberSummary = { userId: string; displayName: string; role: CampaignRole; joinedAt: string }

/** A character as the campaign page's card shows it. */
export type CampaignCharacterCard = {
  id: string
  name: string
  ownerUserId: string
  ownerName: string
  raceTitle: string
  hp: { current: number; effectiveMax: number }
  heartDie: { current: HeartDie; max: number }
  woundCount: number
  /** Active conditions, titled from the catalogue (or the custom name), with their level when they have one. */
  conditions: { id: string; title: string; level: number | null; permanent: boolean }[]
  revision: number
}

export type CampaignDetail = {
  id: string
  name: string
  /** The viewer's role. */
  role: CampaignRole
  currentDay: number
  members: MemberSummary[]
  characters: CampaignCharacterCard[]
}

export type CreateCampaignInput = { name: string }
export type CampaignRef = { campaignId: string }
export type CreateInviteInput = { campaignId: string; maxUses?: number | null }
export type AcceptInviteInput = { token: string }
export type AssignInput = { characterId: string; campaignId: string }
export type RemoveInput = { characterId: string }
export type AwardXpInput = { campaignId: string; amount: number }

export type CreateInviteOk = { ok: true; token: string; path: string; expiresAt: string; maxUses: number | null }
export type AcceptInviteOk = { ok: true; campaignId: string; /** false when the user was already a member (no use consumed). */ joined: boolean }
export type AwardXpOk = {
  ok: true
  /** Each character that received the award, with the revision its `xp:award` event produced. */
  awarded: { characterId: string; revision: number }[]
  /** Characters the award could not be applied to, with the reason. */
  failed: { characterId: string; code: string; message: string }[]
  /** The open session the award was logged on; null when no session was open or nobody received it. */
  sessionId: string | null
}

// ---- Helpers -----------------------------------------------------------------------------------

const STATUS: Record<CampaignErrorCode, number> = {
  forbidden: 403, not_found: 404, bad_input: 400, invite_expired: 410, is_draft: 409, already_in_campaign: 409, not_in_campaign: 409,
}

const refuse = (code: CampaignErrorCode, message: string): CampaignRefusal => ({ ok: false, status: STATUS[code], code, message })

const isRefusal = (v: object): v is CampaignRefusal => 'ok' in v && (v as { ok: unknown }).ok === false

const badId = (id: unknown, what: string): CampaignRefusal | null =>
  typeof id === 'string' && id ? null : refuse('bad_input', `${what} must be a non-empty string`)

export const MAX_NAME_LENGTH = 80
export const INVITE_DAYS = 7
export const INVITE_TOKEN_BYTES = 16
const AWARD_RETRIES = 3

/** 16 random bytes as base64url: 22 characters, no padding. */
export function newInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_TOKEN_BYTES))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** The user's role in the campaign, or the refusal to return when they have none (a non-member learns nothing else). */
async function memberOf(db: D1Database, userId: string, campaignId: string): Promise<CampaignRole | CampaignRefusal> {
  const role = await roleIn(db, campaignId, userId)
  return role ?? refuse('forbidden', 'You are not in this campaign')
}

async function gmOf(db: D1Database, userId: string, campaignId: string): Promise<CampaignRefusal | null> {
  const role = await memberOf(db, userId, campaignId)
  if (typeof role !== 'string') return role
  return role === 'gm' ? null : refuse('forbidden', 'Only the GM can do that')
}

// ---- Campaigns ---------------------------------------------------------------------------------

/** Creates a campaign and inserts its creator as `gm`, in one batch. */
export async function createCampaign(db: D1Database, userId: string, input: CreateCampaignInput): Promise<{ ok: true; campaignId: string } | CampaignRefusal> {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!name) return refuse('bad_input', 'A campaign needs a name')
  if (name.length > MAX_NAME_LENGTH) return refuse('bad_input', `A campaign name is at most ${MAX_NAME_LENGTH} characters`)
  const id = ulid()
  await db.batch([
    db.prepare('INSERT INTO campaign (id, name, gm_user_id) VALUES (?, ?, ?)').bind(id, name, userId),
    db.prepare("INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, 'gm')").bind(id, userId),
  ])
  return { ok: true, campaignId: id }
}

/** The campaigns the user belongs to, newest membership first. */
export async function listMyCampaigns(db: D1Database, userId: string): Promise<{ ok: true; campaigns: CampaignSummary[] }> {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.name, c.current_day, m.role,
              (SELECT COUNT(*) FROM campaign_member x WHERE x.campaign_id = c.id) AS member_count
         FROM campaign_member m JOIN campaign c ON c.id = m.campaign_id
        WHERE m.user_id = ? ORDER BY m.joined_at DESC, c.id DESC`,
    )
    .bind(userId)
    .all<{ id: string; name: string; current_day: number; role: CampaignRole; member_count: number }>()
  return { ok: true, campaigns: results.map((r) => ({ id: r.id, name: r.name, role: r.role, currentDay: r.current_day, memberCount: r.member_count })) }
}

/** The campaign page's data: members and the finished characters in it as card data. Members only. */
export async function getCampaign(db: D1Database, userId: string, input: CampaignRef): Promise<{ ok: true; campaign: CampaignDetail } | CampaignRefusal> {
  const bad = badId(input?.campaignId, 'campaignId')
  if (bad) return bad
  const role = await memberOf(db, userId, input.campaignId)
  if (typeof role !== 'string') return role
  const campaign = await db.prepare('SELECT id, name, current_day FROM campaign WHERE id = ?').bind(input.campaignId).first<{ id: string; name: string; current_day: number }>()
  if (!campaign) return refuse('not_found', 'No such campaign')
  const [{ results: members }, { results: characters }] = await Promise.all([
    db
      .prepare(
        `SELECT m.user_id, m.role, m.joined_at, u.display_name FROM campaign_member m JOIN user u ON u.id = m.user_id
          WHERE m.campaign_id = ? ORDER BY (m.role = 'gm') DESC, m.joined_at, m.user_id`,
      )
      .bind(input.campaignId)
      .all<{ user_id: string; role: CampaignRole; joined_at: string; display_name: string }>(),
    db
      .prepare(
        `SELECT ch.id, ch.owner_user_id, ch.state, ch.revision, u.display_name FROM character ch JOIN user u ON u.id = ch.owner_user_id
          WHERE ch.campaign_id = ? AND json_extract(ch.state, '$.draft') = 0 ORDER BY ch.created_at, ch.id`,
      )
      .bind(input.campaignId)
      .all<{ id: string; owner_user_id: string; state: string; revision: number; display_name: string }>(),
  ])
  const conditions = getCatalogue().conditions
  return {
    ok: true,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      role,
      currentDay: campaign.current_day,
      members: members.map((m) => ({ userId: m.user_id, displayName: m.display_name, role: m.role, joinedAt: m.joined_at })),
      characters: characters.map((r): CampaignCharacterCard => {
        const c = upgradeCharacter(JSON.parse(r.state))
        if (c.draft) throw new Error(`character ${r.id} is a draft in campaign ${input.campaignId}`)
        return {
          id: r.id,
          name: c.identity.name,
          ownerUserId: r.owner_user_id,
          ownerName: r.display_name,
          raceTitle: c.kin.titleSnapshot,
          hp: { current: c.hp.current, effectiveMax: effectiveMaxHp(c) },
          heartDie: { current: c.hp.heartDieCurrent, max: maxHeartDie(c) },
          woundCount: c.wounds.length,
          conditions: c.conditions.map((k) => ({
            id: k.id,
            title: (k.conditionId !== null ? conditions.get(k.conditionId)?.title : undefined) ?? k.name ?? 'Condition',
            level: k.level,
            permanent: k.permanent,
          })),
          revision: r.revision,
        }
      }),
    },
  }
}

// ---- Invites -----------------------------------------------------------------------------------

/** A seven-day invite link for the campaign's GM. `maxUses` null or absent means unlimited. */
export async function createInvite(db: D1Database, userId: string, input: CreateInviteInput): Promise<CreateInviteOk | CampaignRefusal> {
  const bad = badId(input?.campaignId, 'campaignId')
  if (bad) return bad
  const maxUses = input.maxUses ?? null
  if (maxUses !== null && !(Number.isSafeInteger(maxUses) && maxUses >= 1)) return refuse('bad_input', 'maxUses must be a positive integer')
  const denied = await gmOf(db, userId, input.campaignId)
  if (denied) return denied
  const token = newInviteToken()
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  await db
    .prepare('INSERT INTO campaign_invite (token, campaign_id, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?, ?)')
    .bind(token, input.campaignId, userId, expiresAt, maxUses)
    .run()
  return { ok: true, token, path: `/join/${token}`, expiresAt, maxUses }
}

/**
 * Joins the campaign as a `player`. One batch: the UPDATE reserves a use only when the invite is live and the user is not
 * already a member, and the INSERT runs only if that UPDATE changed a row (`changes() = 1`), so two accepts of a last use
 * produce exactly one membership. 0 changes means the user is already a member (no use is consumed; answer with the
 * campaign) or the invite is unknown, expired or used up (one refusal, so a stranger cannot probe tokens).
 */
export async function acceptInvite(db: D1Database, userId: string, input: AcceptInviteInput): Promise<AcceptInviteOk | CampaignRefusal> {
  const bad = badId(input?.token, 'token')
  if (bad) return bad
  const now = new Date().toISOString()
  const results = await db.batch([
    db
      .prepare(
        `UPDATE campaign_invite SET uses = uses + 1
          WHERE token = ? AND expires_at > ? AND (max_uses IS NULL OR uses < max_uses)
            AND NOT EXISTS (SELECT 1 FROM campaign_member WHERE campaign_id = campaign_invite.campaign_id AND user_id = ?)`,
      )
      .bind(input.token, now, userId),
    db
      .prepare(
        `INSERT INTO campaign_member (campaign_id, user_id, role, joined_at)
         SELECT campaign_id, ?, 'player', ? FROM campaign_invite WHERE token = ? AND changes() = 1`,
      )
      .bind(userId, now, input.token),
  ])
  const invite = await db.prepare('SELECT campaign_id FROM campaign_invite WHERE token = ?').bind(input.token).first<{ campaign_id: string }>()
  if (results[0].meta.changes === 1) {
    if (results[1].meta.changes !== 1 || !invite) throw new Error('Invite use was reserved but the membership was not inserted')
    return { ok: true, campaignId: invite.campaign_id, joined: true }
  }
  if (invite && (await roleIn(db, invite.campaign_id, userId)) !== null) return { ok: true, campaignId: invite.campaign_id, joined: false }
  return refuse('invite_expired', 'This invite has expired; ask your GM for a new one')
}

// ---- Characters in a campaign ------------------------------------------------------------------

type CharacterHead = { owner_user_id: string; campaign_id: string | null; draft: number }

const headOf = (db: D1Database, characterId: string) =>
  db.prepare("SELECT owner_user_id, campaign_id, json_extract(state, '$.draft') AS draft FROM character WHERE id = ?").bind(characterId).first<CharacterHead>()

/**
 * Puts one of the user's finished characters in a campaign they belong to. One campaign per character; the guards are in
 * the UPDATE's WHERE so a concurrent change cannot slip past a read. Adding to the campaign it is already in is a no-op.
 */
export async function assignCharacterToCampaign(db: D1Database, userId: string, input: AssignInput): Promise<{ ok: true; campaignId: string } | CampaignRefusal> {
  const bad = badId(input?.characterId, 'characterId') ?? badId(input?.campaignId, 'campaignId')
  if (bad) return bad
  const result = await db
    .prepare(
      `UPDATE character SET campaign_id = ?
        WHERE id = ? AND owner_user_id = ? AND campaign_id IS NULL AND json_extract(state, '$.draft') = 0
          AND EXISTS (SELECT 1 FROM campaign_member WHERE campaign_id = ? AND user_id = ?)`,
    )
    .bind(input.campaignId, input.characterId, userId, input.campaignId, userId)
    .run()
  if (result.meta.changes === 1) return { ok: true, campaignId: input.campaignId }
  const head = await headOf(db, input.characterId)
  if (!head) return refuse('not_found', 'No such character')
  if (head.owner_user_id !== userId) return refuse('forbidden', 'Only the owner can add a character to a campaign')
  if (head.draft) return refuse('is_draft', 'Finish the character before adding it to a campaign')
  if (head.campaign_id === input.campaignId) return { ok: true, campaignId: input.campaignId }
  if (head.campaign_id !== null) return refuse('already_in_campaign', 'This character is already in a campaign; remove it there first')
  return refuse('forbidden', 'You are not in this campaign')
}

/** Takes the user's character out of its campaign. Returns the campaign it left. */
export async function removeCharacterFromCampaign(db: D1Database, userId: string, input: RemoveInput): Promise<{ ok: true; campaignId: string } | CampaignRefusal> {
  const bad = badId(input?.characterId, 'characterId')
  if (bad) return bad
  const head = await headOf(db, input.characterId)
  if (!head) return refuse('not_found', 'No such character')
  if (head.owner_user_id !== userId) return refuse('forbidden', 'Only the owner can remove a character from a campaign')
  if (head.campaign_id === null) return refuse('not_in_campaign', 'This character is in no campaign')
  const result = await db
    .prepare('UPDATE character SET campaign_id = NULL WHERE id = ? AND owner_user_id = ? AND campaign_id = ?')
    .bind(input.characterId, userId, head.campaign_id)
    .run()
  if (result.meta.changes !== 1) return refuse('not_in_campaign', 'This character is in no campaign')
  return { ok: true, campaignId: head.campaign_id }
}

// ---- Award XP ----------------------------------------------------------------------------------

/**
 * The GM awards `amount` XP to every finished character in the campaign: one `xp:award` event each, through C1's
 * `applyCharacterAction` (so Craven's bonus applies and undo works). A revision conflict is retried on the current revision;
 * any other refusal is reported in `failed` and does not stop the others. When the campaign has an open session, `{amount, at}`
 * is appended to its `xp_awards` once, atomically (spec §2.2); with no open session no session changes.
 */
export async function awardXpToCampaign(db: D1Database, userId: string, input: AwardXpInput): Promise<AwardXpOk | CampaignRefusal> {
  const bad = badId(input?.campaignId, 'campaignId')
  if (bad) return bad
  if (!Number.isSafeInteger(input.amount) || input.amount < 1) return refuse('bad_input', 'The amount must be a whole number of at least 1')
  const denied = await gmOf(db, userId, input.campaignId)
  if (denied) return denied

  const { results: rows } = await db
    .prepare("SELECT id, revision FROM character WHERE campaign_id = ? AND json_extract(state, '$.draft') = 0 ORDER BY created_at, id")
    .bind(input.campaignId)
    .all<{ id: string; revision: number }>()
  const at = new Date().toISOString()
  const awarded: AwardXpOk['awarded'] = []
  const failed: AwardXpOk['failed'] = []
  for (const row of rows) {
    let revision = row.revision
    for (let attempt = 1; ; attempt++) {
      const result = await applyCharacterAction(db, userId, {
        characterId: row.id,
        revision,
        action: { kind: 'xp:award', amount: input.amount, id: ulid(), at },
      })
      if (result.ok) {
        awarded.push({ characterId: row.id, revision: result.character.revision })
        break
      }
      if (result.code === 'conflict' && result.character && attempt < AWARD_RETRIES) {
        revision = result.character.revision
        continue
      }
      failed.push({ characterId: row.id, code: result.code, message: result.message })
      break
    }
  }

  let sessionId: string | null = null
  if (awarded.length > 0) {
    const session = await db
      .prepare("UPDATE campaign_session SET xp_awards = json_insert(xp_awards, '$[#]', json(?)) WHERE campaign_id = ? AND end_day IS NULL RETURNING id")
      .bind(JSON.stringify({ amount: input.amount, at }), input.campaignId)
      .first<{ id: string }>()
    sessionId = session?.id ?? null
  }
  return { ok: true, awarded, failed, sessionId }
}

// ---- Live updates (INV-LIVE) -------------------------------------------------------------------

type ChannelEnv = Parameters<typeof publish>[0]

/** After membership or a campaign's character list changed: tell the campaign's pages to refetch (best effort). */
export async function publishCampaignChange(env: ChannelEnv, campaignId: string | null | undefined): Promise<void> {
  if (campaignId) await publish(env, campaignId, { type: 'campaign' })
}

/** After Award XP: each character's sheet refetches, and the Sessions tab when the award was logged on a session. */
export async function publishAward(env: ChannelEnv, campaignId: string, result: AwardXpOk | CampaignRefusal): Promise<void> {
  if (!result.ok) return
  for (const a of result.awarded) await publish(env, campaignId, { type: 'character', characterId: a.characterId, revision: a.revision })
  if (result.sessionId) await publish(env, campaignId, { type: 'campaign' })
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

export const createCampaignFn = createServerFn({ method: 'POST' })
  .validator(input<CreateCampaignInput>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return createCampaign(db, userId, data) // a new campaign has no open pages: nothing to publish
  })

export const listMyCampaignsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { db, userId } = await context()
  return listMyCampaigns(db, userId)
})

export const getCampaignFn = createServerFn({ method: 'GET' })
  .validator(input<CampaignRef>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return getCampaign(db, userId, data)
  })

export const createInviteFn = createServerFn({ method: 'POST' })
  .validator(input<CreateInviteInput>())
  .handler(async ({ data }) => {
    const { db, userId } = await context()
    return createInvite(db, userId, data)
  })

export const acceptInviteFn = createServerFn({ method: 'POST' })
  .validator(input<AcceptInviteInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const result = await acceptInvite(db, userId, data)
    if (result.ok && result.joined) await publishCampaignChange(env, result.campaignId)
    return result
  })

export const assignCharacterToCampaignFn = createServerFn({ method: 'POST' })
  .validator(input<AssignInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const result = await assignCharacterToCampaign(db, userId, data)
    if (result.ok) await publishCampaignChange(env, result.campaignId)
    return result
  })

export const removeCharacterFromCampaignFn = createServerFn({ method: 'POST' })
  .validator(input<RemoveInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const result = await removeCharacterFromCampaign(db, userId, data)
    if (result.ok) await publishCampaignChange(env, result.campaignId)
    return result
  })

export const awardXpToCampaignFn = createServerFn({ method: 'POST' })
  .validator(input<AwardXpInput>())
  .handler(async ({ data }) => {
    const { env, db, userId } = await context()
    const result = await awardXpToCampaign(db, userId, data)
    await publishAward(env, data.campaignId, result)
    return result
  })
