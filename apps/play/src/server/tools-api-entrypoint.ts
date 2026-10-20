// The service-binding face of `tools-api.ts`: tools declares `{"binding":"PLAY","service":"heartrush-play","entrypoint":"ToolsApi"}`
// and calls these methods over RPC. Kept apart because this file imports `cloudflare:workers`, which the Node tests cannot load.
import { WorkerEntrypoint } from 'cloudflare:workers'
import * as api from './tools-api'

/** Not reachable by URL: a service binding is the only way in, and the user id it carries is tools' signed-in user. */
export class ToolsApi extends WorkerEntrypoint<Env> {
  listGmCampaigns(userId: string) {
    return api.listGmCampaigns(this.env.DB, userId)
  }
  getCampaignForEncounter(userId: string, campaignId: string) {
    return api.getCampaignForEncounter(this.env.DB, userId, campaignId)
  }
  listSessions(userId: string, campaignId: string) {
    return api.listSessions(this.env.DB, userId, campaignId)
  }
  attachEncounter(userId: string, campaignId: string, sessionId: string, encounter: { encounterId: string; title: string }) {
    return api.attachEncounter(this.env.DB, this.env, userId, campaignId, sessionId, encounter)
  }
}
