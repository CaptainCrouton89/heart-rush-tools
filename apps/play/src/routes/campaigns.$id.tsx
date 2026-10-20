import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@heartrush/ui/components/tabs'
import { AddMyCharacter } from '~/components/campaign/AddMyCharacter'
import { AwardXp } from '~/components/campaign/AwardXp'
import { CharacterCard } from '~/components/campaign/CharacterCard'
import { GmAssistantPanel, useGmAssistant } from '~/components/campaign/GmAssistantPanel'
import { InviteLink } from '~/components/campaign/InviteLink'
import { LiveStatus } from '~/components/campaign/LiveStatus'
import { MemberList } from '~/components/campaign/MemberList'
import { DayControl } from '~/components/campaign/tabs/DayControl'
import { RollFeed } from '~/components/campaign/tabs/RollFeed'
import { SessionsTab } from '~/components/campaign/tabs/SessionsTab'
import { StratagemsTab } from '~/components/campaign/tabs/StratagemsTab'
import { useCampaignLive } from '~/components/live/use-live'
import { listSessionsFn, listStratagemsFn } from '~/server/campaign-play'
import { getCampaignFn } from '~/server/campaigns'
import { listCharactersFn } from '~/server/characters'
import type { LiveRoll } from '~/server/live'
import { listRollsFn, ROLL_LIMIT, type RollRecord } from '~/server/rolls'

export const Route = createFileRoute('/campaigns/$id')({
  // Every read calls requireUser: signed out, a page load redirects to sign-in and back here. Live events re-run this
  // loader (`router.invalidate()`), so everything the tabs show is read here and passed down.
  loader: async ({ params }) => {
    const campaignId = params.id
    const [campaign, sessions, stratagems, rolls, mine] = await Promise.all([
      getCampaignFn({ data: { campaignId } }),
      listSessionsFn({ data: { campaignId } }),
      listStratagemsFn({ data: { campaignId } }),
      listRollsFn({ data: { campaignId } }),
      listCharactersFn(),
    ])
    // A campaign you are not in reads as "not found", as a character does.
    if (!campaign.ok) throw notFound()
    if (!sessions.ok || !stratagems.ok || !rolls.ok) throw new Error(`campaign ${campaignId}: a tab's read was refused`)
    return {
      campaign: campaign.campaign,
      sessions: sessions.sessions,
      betweenSessions: sessions.betweenSessions,
      stratagems: stratagems.stratagems,
      rolls: rolls.rolls,
      // Add my character: the viewer's finished characters that are in no campaign.
      candidates: mine.characters.filter((c) => !c.draft && c.campaignId === null),
    }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.campaign.name ?? 'Campaign'} · Heart Rush Play` }] }),
  component: CampaignPage,
  notFoundComponent: () => (
    <div className="mx-auto w-full max-w-xl px-5 pt-16">
      <h1 className="font-serif text-h2-sm font-semibold">Campaign not found</h1>
      <p className="mt-2 text-body-sm text-muted-foreground">It does not exist, or you are not in it.</p>
      <a href="/campaigns" className="mt-4 inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
        Back to your campaigns
      </a>
    </div>
  ),
})

type Tab = 'characters' | 'sessions' | 'stratagems' | 'rolls'

const DESKTOP = '(min-width: 1024px)'

/**
 * The feed: the loaded rolls (the server's newest 200) with live rolls folded in, newest first, at most 200.
 * A live roll the loader has not read yet shows when it is newer than the newest loaded roll (roll ids increase with
 * time); an older one missing from the loaded list was dropped by the 200 limit and stays out. A live copy replaces a
 * loaded copy that is still `pending`, so a resolution that lands during a loader read shows at once.
 */
function mergeRolls(loaded: RollRecord[], live: RollRecord[]): RollRecord[] {
  const liveById = new Map(live.map((r) => [r.id, r]))
  const newest = loaded[0]?.id ?? ''
  const fresh = live.filter((r) => r.id > newest).sort((a, b) => (a.id < b.id ? 1 : -1))
  const current = loaded.map((r) => {
    const update = liveById.get(r.id)
    return update && r.complication === 'pending' ? update : r
  })
  return [...fresh, ...current].slice(0, ROLL_LIMIT)
}

function CampaignPage() {
  const { campaign, sessions, betweenSessions, stratagems, rolls: loadedRolls, candidates } = Route.useLoaderData()
  const isGm = campaign.role === 'gm'

  // A roll arriving on the live channel shows at once; the refetch it also triggers brings the same roll from the server.
  // A resolved complication arrives again with the same id: the newer copy replaces the older.
  const [liveRolls, setLiveRolls] = useState<RollRecord[]>([])
  const onRoll = useCallback((roll: LiveRoll) => {
    const record = roll as RollRecord
    setLiveRolls((prev) => [record, ...prev.filter((r) => r.id !== record.id)].slice(0, ROLL_LIMIT))
  }, [])
  const { status } = useCampaignLive(campaign.id, onRoll)
  const rolls = useMemo(() => mergeRolls(loadedRolls, liveRolls.filter((r) => r.campaignId === campaign.id)), [liveRolls, loadedRolls, campaign.id])

  const assistant = useGmAssistant(campaign.id, campaign.characters)
  const [tab, setTab] = useState<Tab>('characters')
  // From 1024 px there is no Rolls tab (the feed is the right column): a Rolls tab picked on a narrower window becomes
  // Characters when the window widens.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP)
    const onChange = () => {
      if (query.matches) setTab((t) => (t === 'rolls' ? 'characters' : t))
    }
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return (
    <>
      <LiveStatus status={status} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 pt-6 pb-10 md:px-8 md:pt-10">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="eyebrow">Campaign</p>
            <h1 className="truncate font-serif text-h1-sm font-semibold md:text-h1">{campaign.name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <DayControl campaign={campaign} />
            {isGm && campaign.characters.length > 0 && (
              <a href={`/campaigns/${campaign.id}/gm`} className="inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
                GM view
              </a>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList aria-label="Campaign" className="overflow-x-auto">
              <TabsTrigger value="characters">Characters</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="stratagems">Stratagems</TabsTrigger>
              <TabsTrigger value="rolls" className="lg:hidden">
                Rolls
              </TabsTrigger>
            </TabsList>

            <TabsContent value="characters" className="grid grid-cols-1 gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
              <div className="flex flex-col gap-6">
                {campaign.characters.length === 0 ? (
                  <p className="text-body-sm text-muted-foreground">No characters in this campaign yet.</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {campaign.characters.map((c) => (
                      <li key={c.id}>
                        <CharacterCard character={c} notes={isGm ? assistant.notesFor(c.name) : []} />
                      </li>
                    ))}
                  </ul>
                )}
                <AddMyCharacter campaignId={campaign.id} candidates={candidates} />
                {isGm && (
                  <section className="flex flex-col gap-3">
                    <h2 className="eyebrow border-b border-border pb-2">GM</h2>
                    <InviteLink campaignId={campaign.id} />
                    <AwardXp campaignId={campaign.id} characters={campaign.characters} />
                  </section>
                )}
                <MemberList members={campaign.members} />
              </div>
              {isGm && <GmAssistantPanel assistant={assistant} />}
            </TabsContent>

            <TabsContent value="sessions" className="pt-2">
              <SessionsTab campaign={campaign} sessions={sessions} betweenSessions={betweenSessions} />
            </TabsContent>
            <TabsContent value="stratagems" className="pt-2">
              <StratagemsTab campaign={campaign} stratagems={stratagems} />
            </TabsContent>
            <TabsContent value="rolls" className="pt-2 lg:hidden">
              <RollFeed campaign={campaign} rolls={rolls} />
            </TabsContent>
          </Tabs>

          <aside className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <RollFeed campaign={campaign} rolls={rolls} />
          </aside>
        </div>
      </div>
    </>
  )
}
