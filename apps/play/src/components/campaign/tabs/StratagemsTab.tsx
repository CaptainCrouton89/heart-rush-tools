import { useMemo, useState } from 'react'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@heartrush/ui/components/button'
import { StratagemCard } from '~/components/campaign/stratagems/StratagemCard'
import { StratagemForm } from '~/components/campaign/stratagems/StratagemForm'
import { campaignWrite } from '~/components/campaign/write'
import type { CampaignDetail } from '~/server/campaigns'
import { createStratagemFn, type StratagemView } from '~/server/campaign-play'

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

/**
 * Every stratagem in the campaign. The GM gets **New stratagem** (the form opens in place) and edits each card; a player
 * sees **Roll** on an open objective their own character leads. Every write is the server's to allow (GM only for every
 * field; an objective roll only by the leader's player on an open objective); hiding a control is not the check.
 */
export function StratagemsTab({ campaign, stratagems }: StratagemsTabProps) {
  const create = useServerFn(createStratagemFn)
  const router = useRouter()
  const { session } = useRouteContext({ from: '__root__' })
  const isGm = campaign.role === 'gm'
  const [adding, setAdding] = useState(false)
  const mine = useMemo(() => new Set(campaign.characters.filter((c) => c.ownerUserId === session?.userId).map((c) => c.id)), [campaign.characters, session?.userId])

  return (
    <div className="flex flex-col gap-4">
      {isGm &&
        (adding ? (
          <StratagemForm
            characters={campaign.characters}
            saveLabel="Create"
            onCancel={() => setAdding(false)}
            onSave={async (fields) => {
              const result = await campaignWrite('create the stratagem', () => create({ data: { campaignId: campaign.id, ...fields } }))
              if (!result.ok) return result.text
              setAdding(false)
              void router.invalidate()
              return null
            }}
          />
        ) : (
          <Button size="compact" variant="line-primary" type="button" className="self-start" onClick={() => setAdding(true)}>
            New stratagem
          </Button>
        ))}
      {stratagems.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">{isGm ? 'No stratagems yet.' : 'No stratagems yet. The GM adds them here.'}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {stratagems.map((s) => (
            <li key={s.id}>
              <StratagemCard campaignId={campaign.id} stratagem={s} isGm={isGm} mine={mine} characters={campaign.characters} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
