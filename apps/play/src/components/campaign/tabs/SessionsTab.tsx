import type { SharedJournalEntry } from '~/server/journal'
import type { CampaignDetail } from '~/server/campaigns'
import type { SessionView } from '~/server/campaign-play'

/**
 * The Sessions tab (spec §2.2). P2 mounts it as the campaign page's "Sessions" panel; CS fills it. The page's loader
 * reads `listSessionsFn` and refetches it on every live event, so the props are always current: a write here only needs
 * to call its server function (which publishes) — or `useRouter().invalidate()` for an immediate refetch.
 */
export type SessionsTabProps = {
  /** The campaign as the page's loader returned it (`id`, `role`, `currentDay`, `members`, `characters`). */
  campaign: CampaignDetail
  /** `listSessionsFn().sessions`: newest first. */
  sessions: SessionView[]
  /** `listSessionsFn().betweenSessions`: shared journal entries written with no session open. */
  betweenSessions: SharedJournalEntry[]
}

export function SessionsTab({ sessions }: SessionsTabProps) {
  return (
    <p className="text-ui text-muted-foreground">
      {sessions.length === 0 ? 'No sessions yet.' : `${sessions.length} session${sessions.length === 1 ? '' : 's'}.`}
    </p>
  )
}
