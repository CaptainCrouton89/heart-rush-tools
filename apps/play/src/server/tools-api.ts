// What tools.heartrush.party may ask of play (spec §7.4, ruling 25): the campaigns a user runs, their characters' numbers
// for an encounter prompt, the campaign's sessions, and attaching a saved encounter to a session.
//
// Reached only through a service binding (see `tools-api-entrypoint.ts`, which wraps these functions); there is no route.
// The user id arrives from tools' own session lookup over that non-public binding, so it is trusted as the caller's
// identity — but the GM role is checked here against `campaign_member` on every call (INV-AUTHZ). Every method is GM only.
//
// Failure is the thrown message, because that is what crosses a service binding: `forbidden` (the user is not the campaign's
// GM, including a player or a stranger), `not_found` (no such campaign or session), `bad_input: <why>` otherwise.
// These functions take `(db, env, userId, …)` and never import `cloudflare:workers`, so the tests call them under Node.
import { upgradeCharacter } from '@heartrush/rules-engine/actions'
import { effectiveMaxHp, maxHeartDie, maxHp } from '@heartrush/rules-engine/derived'
import type { Size, DamageType } from '@heartrush/rules-engine/types'
import { roleIn } from './authz'
import { attachEncounter as attachToSession } from './campaign-play'
import type { publish } from './live'

type ChannelEnv = Parameters<typeof publish>[0]

export type CampaignSummary = { id: string; name: string }
export type CampaignCharacter = {
  name: string
  bloodmarks: number
  maxHp: number
  effectiveMaxHp: number
  maxHeartDie: number
  wielded: { size: Size; damageType: DamageType } | null
  talents: string[]
}
export type CampaignForEncounter = { name: string; characters: CampaignCharacter[] }
export type CampaignSession = { id: string; number: number; open: boolean }

/** The campaign's name, once the user is known to be its GM. Unknown campaign → `not_found`; any other role → `forbidden`. */
async function requireGm(db: D1Database, userId: unknown, campaignId: unknown): Promise<string> {
  if (typeof userId !== 'string' || !userId) throw new Error('forbidden')
  if (typeof campaignId !== 'string' || !campaignId) throw new Error('bad_input: campaignId must be a non-empty string')
  const campaign = await db.prepare('SELECT name FROM campaign WHERE id = ?').bind(campaignId).first<{ name: string }>()
  if (!campaign) throw new Error('not_found')
  if ((await roleIn(db, campaignId, userId)) !== 'gm') throw new Error('forbidden')
  return campaign.name
}

/** The campaigns the user is GM of, newest membership first. Players' campaigns are not listed. */
export async function listGmCampaigns(db: D1Database, userId: string): Promise<CampaignSummary[]> {
  if (typeof userId !== 'string' || !userId) throw new Error('forbidden')
  const { results } = await db
    .prepare(
      `SELECT c.id, c.name FROM campaign_member m JOIN campaign c ON c.id = m.campaign_id
        WHERE m.user_id = ? AND m.role = 'gm' ORDER BY m.joined_at DESC, c.id DESC`,
    )
    .bind(userId)
    .all<CampaignSummary>()
  return results.map((r) => ({ id: r.id, name: r.name }))
}

/** The campaign's finished characters with the numbers an encounter needs, computed by the rules engine. */
export async function getCampaignForEncounter(db: D1Database, userId: string, campaignId: string): Promise<CampaignForEncounter> {
  const name = await requireGm(db, userId, campaignId)
  const { results } = await db
    .prepare("SELECT id, state FROM character WHERE campaign_id = ? AND json_extract(state, '$.draft') = 0 ORDER BY created_at, id")
    .bind(campaignId)
    .all<{ id: string; state: string }>()
  const characters = results.map((r): CampaignCharacter => {
    const c = upgradeCharacter(JSON.parse(r.state))
    if (c.draft) throw new Error(`character ${r.id} is a draft in campaign ${campaignId}`)
    const weapon = c.gear.weapons.find((w) => w.wielded)
    return {
      name: c.identity.name,
      bloodmarks: c.bloodmarks.level,
      maxHp: maxHp(c),
      effectiveMaxHp: effectiveMaxHp(c),
      maxHeartDie: maxHeartDie(c),
      wielded: weapon ? { size: weapon.size, damageType: weapon.damageType } : null,
      talents: c.talents.map((t) => t.titleSnapshot),
    }
  })
  return { name, characters }
}

/** The campaign's sessions, newest first. */
export async function listSessions(db: D1Database, userId: string, campaignId: string): Promise<CampaignSession[]> {
  await requireGm(db, userId, campaignId)
  const { results } = await db
    .prepare('SELECT id, number, end_day FROM campaign_session WHERE campaign_id = ? ORDER BY number DESC')
    .bind(campaignId)
    .all<{ id: string; number: number; end_day: number | null }>()
  return results.map((s) => ({ id: s.id, number: s.number, open: s.end_day === null }))
}

/**
 * Attaches a saved encounter to one of the campaign's sessions (P3's `attachEncounter`, which stores the id and title and
 * publishes a campaign event). Attaching the same encounter again renames it. A session of another campaign is `not_found`.
 */
export async function attachEncounter(
  db: D1Database, env: ChannelEnv, userId: string, campaignId: string, sessionId: string, encounter: { encounterId: string; title: string },
): Promise<void> {
  await requireGm(db, userId, campaignId)
  const result = await attachToSession(db, env, userId, campaignId, sessionId, encounter)
  if (result.ok) return
  throw new Error(result.code === 'forbidden' || result.code === 'not_found' ? result.code : `${result.code}: ${result.message}`)
}
