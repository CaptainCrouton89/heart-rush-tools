import { env } from 'cloudflare:workers'

/**
 * The tools side of play.heartrush.party's `ToolsApi` (spec §7.4): the only code that touches the `PLAY` service binding. Every
 * call carries the user id from tools' own session; play checks the GM role itself and rejects with `Error('forbidden')` or
 * `Error('not_found')`, whose message crosses the binding.
 *
 * `PLAY` is not declared in wrangler.jsonc until play deploys its `ToolsApi` entrypoint (a binding to a Worker without it deploys,
 * but every call fails). While it is absent, `playAvailable()` is false and the campaign picker and Add to campaign stay hidden.
 */

export type CampaignSummary = { id: string; name: string }
export type CampaignCharacter = {
  name: string
  bloodmarks: number
  maxHp: number
  effectiveMaxHp: number
  maxHeartDie: number
  /** Size H heavy, L light, UL ultralight; damage type B bludgeoning, S slashing, P piercing. */
  wielded: { size: 'H' | 'L' | 'UL'; damageType: 'B' | 'S' | 'P' } | null
  talents: string[]
}
export type CampaignForEncounter = { name: string; characters: CampaignCharacter[] }
export type CampaignSession = { id: string; number: number; open: boolean }

/** play's `ToolsApi` WorkerEntrypoint, as seen through the binding. */
type ToolsApi = {
  listGmCampaigns(userId: string): Promise<CampaignSummary[]>
  getCampaignForEncounter(userId: string, campaignId: string): Promise<CampaignForEncounter>
  listSessions(userId: string, campaignId: string): Promise<CampaignSession[]>
  attachEncounter(userId: string, campaignId: string, sessionId: string, encounter: { encounterId: string; title: string }): Promise<void>
}

// Read without a global Env declaration, so the `PLAY` type `wrangler types` generates once the binding exists cannot conflict.
const binding = () => (env as unknown as { PLAY?: ToolsApi }).PLAY

/** Whether this Worker has the `PLAY` binding. */
export const playAvailable = () => binding() !== undefined

/** A refused or failed call to play, with the HTTP status tools answers with and a message fit for the GM. */
export class PlayError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404 | 502 | 503,
  ) {
    super(message)
  }
}

async function call<T>(what: string, run: (play: ToolsApi) => Promise<T>): Promise<T> {
  const play = binding()
  if (!play) throw new PlayError('Campaigns from play.heartrush.party are not available yet.', 503)
  try {
    return await run(play)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'forbidden') throw new PlayError('You are not the GM of that campaign on play.heartrush.party.', 403)
    if (message === 'not_found') throw new PlayError('That campaign or session no longer exists on play.heartrush.party.', 404)
    console.error(`play ${what} failed`, error)
    throw new PlayError('Could not reach play.heartrush.party. Try again.', 502)
  }
}

export const listGmCampaigns = (userId: string) => call('listGmCampaigns', (p) => p.listGmCampaigns(userId))

/** Refuses a campaign this user is not GM of, before tools stores it on an encounter. */
export async function assertGmOf(userId: string, campaignId: string): Promise<void> {
  if (!(await listGmCampaigns(userId)).some((c) => c.id === campaignId)) {
    throw new PlayError('You are not the GM of that campaign on play.heartrush.party.', 403)
  }
}

export const getCampaignForEncounter = (userId: string, campaignId: string) =>
  call('getCampaignForEncounter', (p) => p.getCampaignForEncounter(userId, campaignId))

export const listSessions = (userId: string, campaignId: string) => call('listSessions', (p) => p.listSessions(userId, campaignId))

export const attachEncounter = (userId: string, campaignId: string, sessionId: string, encounter: { encounterId: string; title: string }) =>
  call('attachEncounter', (p) => p.attachEncounter(userId, campaignId, sessionId, encounter))

/** A `PlayError` as the JSON error response the client's `ApiError` reads. */
export const playErrorResponse = (error: PlayError) => Response.json({ error: error.message }, { status: error.status })
