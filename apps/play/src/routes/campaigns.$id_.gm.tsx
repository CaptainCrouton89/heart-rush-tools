// The GM view (design "Campaign page and GM view"): every character in the campaign as a full sheet, one per tab in a
// horizontal strip, for a laptop at the table. Non-nested (`$id_`) because the campaign page renders no <Outlet/>; the
// URL is still /campaigns/$id/gm. The sheets are the sheet route's own arrangement (`SheetLayout`), editable by the GM.
import { useCallback, useState } from 'react'
import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@heartrush/ui/components/tabs'
import { getCatalogue } from '~/catalogue'
import { LiveStatus } from '~/components/campaign/LiveStatus'
import { useCampaignLive } from '~/components/live/use-live'
import { AbilityRows, SpeedLine } from '~/components/sheet/AbilityRows'
import { DAMAGE_AMOUNT_ID, DamagePad } from '~/components/sheet/DamagePad'
import { HistoryList, describeAction } from '~/components/sheet/HistoryList'
import { IdentityHeader } from '~/components/sheet/IdentityHeader'
import { SheetLayout, type SectionProps } from '~/components/sheet/SheetLayout'
import { StickyBar } from '~/components/sheet/StickyBar'
import { UndoChip, type UndoOffer } from '~/components/sheet/UndoChip'
import { useCharacter, type ActionDraft, type Outcome } from '~/components/sheet/use-character'
import { getCampaignFn } from '~/server/campaigns'
import { getCharacterFn, type CharacterDoc } from '~/server/characters'

export const Route = createFileRoute('/campaigns/$id_/gm')({
  loader: async ({ params }) => {
    const result = await getCampaignFn({ data: { campaignId: params.id } })
    if (!result.ok) throw notFound()
    const { campaign } = result
    // The view is the GM's; a player gets the campaign page.
    if (campaign.role !== 'gm') throw redirect({ to: '/campaigns/$id', params: { id: campaign.id } })
    const docs = await Promise.all(campaign.characters.map((c) => getCharacterFn({ data: { characterId: c.id } })))
    // A character that left the campaign between the two reads is skipped; the next live event refetches.
    const characters = docs.flatMap((d): CharacterDoc[] => (d.ok && !d.character.state.draft && d.character.campaignId === campaign.id ? [d.character] : []))
    return { campaign: { id: campaign.id, name: campaign.name }, characters }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `GM view · ${loaderData?.campaign.name ?? 'Campaign'} · Heart Rush Play` }] }),
  component: GmView,
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

function GmView() {
  const { campaign, characters } = Route.useLoaderData()
  const { status } = useCampaignLive(campaign.id)
  const [picked, setPicked] = useState<string | null>(null)
  // The picked tab, or the first character when it is gone (or nothing was picked yet).
  const tab = characters.some((c) => c.id === picked) ? picked! : (characters[0]?.id ?? '')

  return (
    <>
      <LiveStatus status={status} />
      <Tabs value={tab} onValueChange={setPicked} className="gap-0">
        <div className="border-b border-border bg-surface">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 md:px-8">
            <a href={`/campaigns/${campaign.id}`} className="inline-flex min-h-11 shrink-0 items-center text-ui text-primary underline underline-offset-4">
              {campaign.name}
            </a>
            <TabsList aria-label="Characters" className="min-w-0 flex-1 overflow-x-auto border-b-0">
              {characters.map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.name || 'Unnamed character'}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
        {characters.length === 0 && (
          <p className="mx-auto w-full max-w-6xl px-5 pt-6 text-body-sm text-muted-foreground md:px-8">No characters in this campaign yet.</p>
        )}
        {characters.map((c) => (
          <TabsContent key={c.id} value={c.id}>
            <GmSheet initial={c} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  )
}

/**
 * One character's full sheet: the sheet route's composition, with its own dispatcher, undo chip and history. Only the
 * shown tab's sheet is mounted (Radix unmounts an inactive panel), so the page has one damage pad and one undo chip.
 */
function GmSheet({ initial }: { initial: CharacterDoc }) {
  const { document, character, derived, role, dispatch, undo, pending, notice, dismissNotice } = useCharacter(initial)
  const catalogue = getCatalogue()
  const canEdit = role === 'owner' || role === 'gm'

  const [offer, setOffer] = useState<UndoOffer | null>(null)
  const expire = useCallback(() => setOffer(null), [])
  const send = useCallback(
    async (action: ActionDraft): Promise<Outcome> => {
      const outcome = await dispatch(action)
      if (outcome.status === 'saved' && outcome.action) {
        setOffer({ eventId: outcome.action.id, text: describeAction(outcome.action, outcome.character.state), revision: outcome.character.revision })
      } else setOffer(null)
      return outcome
    },
    [dispatch],
  )
  const undoEvent = useCallback(
    (eventId: string) => {
      setOffer(null)
      void undo(eventId)
    },
    [undo],
  )
  const shownOffer = offer && !pending && offer.revision === document.revision ? offer : null

  const props: SectionProps = { character, derived, catalogue, dispatch: send, canEdit }
  const openPad = () => {
    const input = window.document.getElementById(DAMAGE_AMOUNT_ID)
    input?.scrollIntoView({ block: 'center' })
    input?.focus()
  }

  return (
    <>
      <SheetLayout
        props={props}
        stickyBar={<StickyBar character={character} derived={derived} onHp={canEdit ? openPad : undefined} />}
        banner={null}
        top={
          <>
            <IdentityHeader character={character} catalogue={catalogue} />
            <AbilityRows character={character} derived={derived} />
            <SpeedLine character={character} derived={derived} />
            {canEdit && <DamagePad dispatch={send} maxHp={derived.effectiveMaxHp} />}
          </>
        }
        history={<HistoryList key={document.id} characterId={document.id} character={character} refreshKey={`${document.revision}:${pending}`} canEdit={canEdit} onUndo={undoEvent} />}
      />
      <UndoChip offer={shownOffer} notice={notice} onUndo={undoEvent} onExpire={expire} onDismissNotice={dismissNotice} />
    </>
  )
}
