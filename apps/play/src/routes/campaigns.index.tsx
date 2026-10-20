import { createFileRoute } from '@tanstack/react-router'
import { CreateCampaign } from '~/components/campaign/CreateCampaign'
import { listMyCampaignsFn, type CampaignSummary } from '~/server/campaigns'

export const Route = createFileRoute('/campaigns/')({
  // listMyCampaignsFn calls requireUser: signed out, a page load redirects to /auth/login?returnTo=/campaigns.
  loader: () => listMyCampaignsFn(),
  head: () => ({ meta: [{ title: 'Campaigns · Heart Rush Play' }] }),
  component: CampaignList,
})

function CampaignList() {
  const { campaigns } = Route.useLoaderData()
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-8 md:px-8 md:pt-12">
      <h1 className="font-serif text-h1-sm font-semibold md:text-h1">Campaigns</h1>
      <CreateCampaign />
      {campaigns.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          You are in no campaigns yet. Create one, or open an invite link from your GM.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {campaigns.map((c) => (
            <li key={c.id}>
              <CampaignCard campaign={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CampaignCard({ campaign: c }: { campaign: CampaignSummary }) {
  return (
    <a
      href={`/campaigns/${c.id}`}
      className="flex min-h-11 flex-col gap-2 rounded-md border border-border bg-surface p-4 text-foreground transition-colors hover:border-muted-foreground hover:bg-surface-muted"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate font-serif text-h4 font-semibold">{c.name}</span>
        <span className="shrink-0 font-sans text-control font-semibold tabular-nums">Day {c.currentDay}</span>
      </span>
      <span className="flex flex-wrap gap-x-3 gap-y-1 text-ui text-muted-foreground">
        <span>{c.role === 'gm' ? 'GM' : 'Player'}</span>
        <span aria-hidden="true">·</span>
        <span>
          {c.memberCount} member{c.memberCount === 1 ? '' : 's'}
        </span>
      </span>
    </a>
  )
}
