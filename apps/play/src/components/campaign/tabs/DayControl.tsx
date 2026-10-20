import type { CampaignDetail } from '~/server/campaigns'

/**
 * The campaign header's day (spec §2.1). P2 mounts it beside the campaign name on `/campaigns/$id`; CS fills it
 * (**+1 day**, **+7 days**, **Set day** for the GM through `setDayFn`). `setDayFn` publishes a campaign event, so the
 * page's loader refetches and `campaign.currentDay` arrives already updated — nothing here needs to refetch.
 */
export type DayControlProps = {
  /** The campaign as the page's loader returned it: `currentDay`, and `role` (the viewer's) for the GM-only controls. */
  campaign: CampaignDetail
}

export function DayControl({ campaign }: DayControlProps) {
  return <span className="font-sans text-control font-semibold tabular-nums">Day {campaign.currentDay}</span>
}
