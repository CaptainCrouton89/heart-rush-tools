import type { CampaignDetail } from '~/server/campaigns'
import type { StratagemView } from '~/server/campaign-play'

/**
 * The Stratagems tab (spec §2.3). P2 mounts it as the campaign page's "Stratagems" panel; CG fills it. The page's
 * loader reads `listStratagemsFn` and refetches it on every live event, so `stratagems` is always current.
 */
export type StratagemsTabProps = {
  /** The campaign as the page's loader returned it (`id`, `role`, `characters` for the leader picker). */
  campaign: CampaignDetail
  /** `listStratagemsFn().stratagems`, in the server's order. */
  stratagems: StratagemView[]
}

export function StratagemsTab({ stratagems }: StratagemsTabProps) {
  return (
    <p className="text-ui text-muted-foreground">
      {stratagems.length === 0 ? 'No stratagems yet.' : `${stratagems.length} stratagem${stratagems.length === 1 ? '' : 's'}.`}
    </p>
  )
}
