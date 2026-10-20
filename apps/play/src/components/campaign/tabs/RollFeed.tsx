import type { CampaignDetail } from '~/server/campaigns'
import type { RollRecord } from '~/server/rolls'

/**
 * The roll feed (spec §3.3), read-only. P2 mounts it twice from one list: in the "Rolls" tab below 1024 px and as the
 * fixed right column from 1024 px. CS fills it. `rolls` is the loader's `listRollsFn().rolls` with every roll received
 * on the live channel since then prepended (deduplicated by id), newest first.
 */
export type RollFeedProps = {
  /** The campaign as the page's loader returned it. */
  campaign: CampaignDetail
  /** Newest first. */
  rolls: RollRecord[]
}

export function RollFeed({ rolls }: RollFeedProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow">Rolls</h2>
      <p className="text-ui text-muted-foreground">{rolls.length === 0 ? 'No rolls yet.' : `${rolls.length} roll${rolls.length === 1 ? '' : 's'}.`}</p>
    </section>
  )
}
