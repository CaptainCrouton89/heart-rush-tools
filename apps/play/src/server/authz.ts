// INV-AUTHZ: who may read or write a character (design Interfaces #3). Every server function resolves the signed-in
// user first, then asks here; nothing the browser sends about owners or roles is trusted.
// Campaign membership is `campaign_member`, the one place a role lives (the GM is inserted there with role 'gm').

export type CampaignRole = 'gm' | 'player'

/** The viewer's relationship to one character. `owner` wins over a campaign role. */
export type CharacterRole = 'owner' | CampaignRole

/** What authorization needs to know about a character: who owns it, where it is, and whether it is a builder draft. */
export type CharacterAccess = { ownerUserId: string; campaignId: string | null; draft: boolean }

/** The user's role in a campaign, or null when they are not a member. */
export async function roleIn(db: D1Database, campaignId: string, userId: string): Promise<CampaignRole | null> {
  const row = await db
    .prepare('SELECT role FROM campaign_member WHERE campaign_id = ? AND user_id = ?')
    .bind(campaignId, userId)
    .first<{ role: CampaignRole }>()
  return row?.role ?? null
}

/**
 * How the user relates to the character, or null when they may not even read it. A draft belongs to its owner alone
 * (a GM or campaign member sees nothing); a finished character is open to its owner and to every member of its campaign.
 */
export async function characterRole(db: D1Database, userId: string, c: CharacterAccess): Promise<CharacterRole | null> {
  if (c.ownerUserId === userId) return 'owner'
  if (c.draft || c.campaignId === null) return null
  return roleIn(db, c.campaignId, userId)
}

/** Write access for a role: the owner, or the GM of the character's campaign. */
export const mayWrite = (role: CharacterRole | null): boolean => role === 'owner' || role === 'gm'

export async function canRead(db: D1Database, userId: string, c: CharacterAccess): Promise<boolean> {
  return (await characterRole(db, userId, c)) !== null
}

export async function canWrite(db: D1Database, userId: string, c: CharacterAccess): Promise<boolean> {
  return mayWrite(await characterRole(db, userId, c))
}
