// Live updates (ruling 20, INV-LIVE): one `CampaignChannel` Durable Object per campaign holds the WebSocket of every open
// page of that campaign. A write that has committed calls `publish`, which hands the event to the object, which sends it to
// every connection. A page that receives an event refetches (`router.invalidate()`); an event is never data to save.
//
// This module is imported by `characters.ts`, which the tests run under Node, so it must not import `cloudflare:workers`.
// The object class itself is in `campaign-channel.ts`; `publish` reaches it through `fetch`.
import { roleIn } from './authz'

/** A roll as the feed shows it. The roll server (RS) defines the row; the channel carries it untouched. */
export type LiveRoll = Record<string, unknown>

/** What a page is told. `character` and `campaign` are prompts to refetch; `roll` also carries the roll for the feed. */
export type LiveEvent =
  | { type: 'character'; characterId: string; revision: number }
  | { type: 'roll'; roll: LiveRoll }
  | { type: 'campaign' }

/** The object's address for publishing; any URL works because the object is reached through its binding, not the network. */
const PUBLISH_URL = 'https://campaign-channel/publish'

type ChannelEnv = Pick<Env, 'CAMPAIGN_CHANNEL'>

const channelOf = (env: ChannelEnv, campaignId: string) => env.CAMPAIGN_CHANNEL.get(env.CAMPAIGN_CHANNEL.idFromName(campaignId))

/** Best effort (INV-LIVE): a failed publish is logged and never throws, so it can never fail a committed write. */
export async function publish(env: ChannelEnv, campaignId: string, event: LiveEvent): Promise<void> {
  try {
    const response = await channelOf(env, campaignId).fetch(PUBLISH_URL, { method: 'POST', body: JSON.stringify(event) })
    if (!response.ok) throw new Error(`channel answered ${response.status}`)
  } catch (error) {
    console.error('live: publish failed', campaignId, event.type, error instanceof Error ? error.message : error)
  }
}

/** After a character write: publish its new revision when it succeeded and the character is in a campaign. */
export async function publishCharacterWrite(
  env: ChannelEnv,
  result: { ok: boolean; character?: { id: string; campaignId: string | null; revision: number } },
): Promise<void> {
  if (!result.ok || !result.character?.campaignId) return
  await publish(env, result.character.campaignId, { type: 'character', characterId: result.character.id, revision: result.character.revision })
}

/**
 * `GET /campaigns/$id/live` for a signed-in user (INV-AUTHZ): only a member of the campaign reaches the object.
 * 426 for a request that is not a WebSocket upgrade, 403 for a non-member (the object is not called), else the object's 101.
 */
export async function connectLive(env: ChannelEnv & Pick<Env, 'DB'>, userId: string, campaignId: string, request: Request): Promise<Response> {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket upgrade.', { status: 426 })
  if ((await roleIn(env.DB, campaignId, userId)) === null) return Response.json({ error: 'Not a member of this campaign.' }, { status: 403 })
  return channelOf(env, campaignId).fetch(request)
}
