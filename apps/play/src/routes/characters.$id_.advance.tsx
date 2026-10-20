// `/characters/$id/advance`: spend XP. The file is `$id_` (not nested under the sheet route, whose component is the
// sheet and renders no child), so the URL is `/characters/$id/advance` and this page stands on its own.
import { useCallback, useState } from 'react'
import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@heartrush/ui/components/tabs'
import { getCatalogue } from '~/catalogue'
import { BloodmarkPicks } from '~/components/advance/BloodmarkPicks'
import { AspectsTab, DestinyTab, DieTab, HpTab, PathTab, type PurchaseTabProps } from '~/components/advance/PurchaseTabs'
import { TalentCatalogue, type XpBuyAction } from '~/components/advance/TalentCatalogue'
import { XpSummary } from '~/components/advance/XpSummary'
import { SuggestTalents } from '~/components/ai/SuggestTalents'
import { useCampaignLive } from '~/components/live/use-live'
import { HistoryList, describeAction } from '~/components/sheet/HistoryList'
import { UndoChip, type UndoOffer } from '~/components/sheet/UndoChip'
import { useCharacter, type ActionDraft, type Outcome } from '~/components/sheet/use-character'
import type { CharacterDoc } from '~/server/characters'
import { getCharacterFn } from '~/server/characters'

export const Route = createFileRoute('/characters/$id_/advance')({
  // getCharacterFn calls requireUser: signed out, a page load redirects to sign-in and back here.
  loader: async ({ params }): Promise<CharacterDoc> => {
    const result = await getCharacterFn({ data: { characterId: params.id } })
    if (!result.ok) throw notFound()
    // A draft spends its XP in the builder's step 6.
    if (result.character.state.draft) throw redirect({ href: `/characters/${params.id}/build` })
    return result.character
  },
  head: ({ loaderData }) => ({ meta: [{ title: `Advance ${loaderData?.name || 'character'} · Heart Rush Play` }] }),
  component: AdvancePage,
  notFoundComponent: () => (
    <div className="mx-auto w-full max-w-xl px-5 pt-16">
      <h1 className="font-serif text-h2-sm font-semibold">Character not found</h1>
      <p className="mt-2 text-body-sm text-muted-foreground">It does not exist, or it is not yours or in your campaign.</p>
      <a href="/characters" className="mt-4 inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
        Back to your characters
      </a>
    </div>
  ),
})

type Tab = 'talents' | 'die' | 'hp' | 'aspects' | 'destiny' | 'path' | 'bloodmarks'

function AdvancePage() {
  const initial = Route.useLoaderData()
  const { document, character, derived, role, dispatch, undo, pending, notice, dismissNotice } = useCharacter(initial)
  useCampaignLive(document.campaignId)
  const catalogue = getCatalogue()
  const canEdit = role === 'owner' || role === 'gm'
  const [tab, setTab] = useState<Tab>('talents')

  const [offer, setOffer] = useState<UndoOffer | null>(null)
  const expire = useCallback(() => setOffer(null), [])
  // Every purchase goes through here; a saved one raises the undo chip. Refund = undo of that (top) event.
  const send = useCallback(
    async (action: ActionDraft): Promise<Outcome> => {
      const outcome = await dispatch(action)
      if (outcome.status === 'saved' && outcome.action) {
        setOffer({ eventId: outcome.action.id, text: describeAction(outcome.action), revision: outcome.character.revision })
      } else setOffer(null)
      return outcome
    },
    [dispatch],
  )
  // The catalogue hands over an already-stamped `xp:buy`; the dispatcher stamps its own id and time.
  const buyTalent = useCallback((action: XpBuyAction) => {
    const { id: _id, at: _at, ...draft } = action
    return send(draft)
  }, [send])
  const undoEvent = useCallback((eventId: string) => {
    setOffer(null)
    void undo(eventId)
  }, [undo])
  const shownOffer = offer && !pending && offer.revision === document.revision ? offer : null

  const owed = derived.bloodmarkPicksOwed
  const owedTotal = Object.values(owed).reduce((s, n) => s + Math.max(0, n), 0)
  const tabProps: PurchaseTabProps = { character, derived, catalogue, dispatch: send }
  const tabs: { value: Tab; label: string; badge?: number }[] = [
    { value: 'talents', label: 'Talents' },
    { value: 'die', label: 'Ability die' },
    { value: 'hp', label: 'Max HP' },
    { value: 'aspects', label: 'Aspects' },
    { value: 'destiny', label: 'Destiny' },
    { value: 'path', label: 'Path' },
    { value: 'bloodmarks', label: 'Bloodmarks', badge: owedTotal },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 pt-6 pb-24 md:px-8 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Spend XP</p>
          <h1 className="truncate font-serif text-h1-sm font-semibold">{character.identity.name || 'Unnamed character'}</h1>
        </div>
        <Link to="/characters/$id" params={{ id: document.id }} className="inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
          Back to the sheet
        </Link>
      </div>

      <XpSummary xp={derived.xp} />

      {!canEdit ? (
        <p className="text-ui text-muted-foreground">Only the character's owner or the campaign's GM can spend its XP.</p>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
            <TabsList aria-label="What to buy" className="w-max min-w-full">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  {t.badge ? (
                    <span className="rounded-sm bg-primary px-1.5 text-meta font-semibold text-primary-foreground tabular-nums" aria-label={`${t.badge} owed`}>
                      {t.badge}
                    </span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="talents">
            <TalentCatalogue character={character} catalogue={catalogue} onBuy={buyTalent} header={<SuggestTalents characterId={document.id} character={character} catalogue={catalogue} onBuy={buyTalent} />} />
          </TabsContent>
          <TabsContent value="die"><DieTab {...tabProps} /></TabsContent>
          <TabsContent value="hp"><HpTab {...tabProps} /></TabsContent>
          <TabsContent value="aspects"><AspectsTab {...tabProps} /></TabsContent>
          <TabsContent value="destiny"><DestinyTab {...tabProps} /></TabsContent>
          <TabsContent value="path"><PathTab {...tabProps} /></TabsContent>
          <TabsContent value="bloodmarks">
            <BloodmarkPicks character={character} owed={owed} dispatch={send} />
          </TabsContent>
        </Tabs>
      )}

      <HistoryList key={document.id} characterId={document.id} refreshKey={`${document.revision}:${pending}`} canEdit={canEdit} onUndo={undoEvent} />
      <UndoChip offer={shownOffer} notice={notice} onUndo={undoEvent} onExpire={expire} onDismissNotice={dismissNotice} />
    </div>
  )
}
