import { useCallback, useState } from 'react'
import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import type { CharacterDoc } from '~/server/characters'
import { getCharacterFn } from '~/server/characters'
import { getCatalogue } from '~/catalogue'
import { LiveStatus } from '~/components/campaign/LiveStatus'
import { useCampaignLive } from '~/components/live/use-live'
import { AbilityRows, SpeedLine } from '~/components/sheet/AbilityRows'
import { DAMAGE_AMOUNT_ID, DamagePad } from '~/components/sheet/DamagePad'
import { HistoryList, describeAction } from '~/components/sheet/HistoryList'
import { IdentityHeader } from '~/components/sheet/IdentityHeader'
import { SheetLayout, type SectionProps } from '~/components/sheet/SheetLayout'
import { StickyBar, type SheetLink } from '~/components/sheet/StickyBar'
import { UndoChip, type UndoOffer } from '~/components/sheet/UndoChip'
import { useCharacter, type ActionDraft, type Outcome } from '~/components/sheet/use-character'

export const Route = createFileRoute('/characters/$id')({
  // getCharacterFn calls requireUser: signed out, a page load redirects to sign-in and back here.
  loader: async ({ params }): Promise<CharacterDoc> => {
    const result = await getCharacterFn({ data: { characterId: params.id } })
    // 403 and 404 both read as "not found": a character you may not see is not acknowledged.
    if (!result.ok) throw notFound()
    // The builder (`/characters/$id/build`) edits a draft; it is a later unit's route, so this is a plain href.
    if (result.character.state.draft) throw redirect({ href: `/characters/${params.id}/build` })
    return result.character
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.name || 'Character'} · Heart Rush Play` }] }),
  component: SheetPage,
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

function SheetPage() {
  const initial = Route.useLoaderData()
  const { document, character, derived, role, dispatch, undo, pending, notice, dismissNotice } = useCharacter(initial)
  // A campaign character's sheet refetches when anyone in the campaign changes something.
  const { status } = useCampaignLive(document.campaignId)
  const catalogue = getCatalogue()
  const canEdit = role === 'owner' || role === 'gm'
  const base = `/characters/${encodeURIComponent(document.id)}`
  const links: SheetLink[] = [
    ...(canEdit ? [{ label: 'Advance', href: `${base}/advance` }, { label: 'Edit', href: `${base}/edit` }] : []),
    ...(document.campaignId ? [{ label: 'Campaign', href: `/campaigns/${encodeURIComponent(document.campaignId)}` }] : []),
  ]

  const [offer, setOffer] = useState<UndoOffer | null>(null)
  const expire = useCallback(() => setOffer(null), [])

  // Every write from the sheet goes through here, so each saved action raises the undo chip with its stamped id.
  const send = useCallback(
    async (action: ActionDraft): Promise<Outcome> => {
      const outcome = await dispatch(action)
      if (outcome.status === 'saved' && outcome.action) {
        setOffer({ eventId: outcome.action.id, text: describeAction(outcome.action), revision: outcome.character.revision })
      }
      else setOffer(null)
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

  // The server undoes only the top event: the offer holds while the sheet still shows the document that save produced. A
  // later change (queued or saved) or another editor's event raises the revision and withdraws it.
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
        stickyBar={<StickyBar character={character} derived={derived} onHp={canEdit ? openPad : undefined} links={links} />}
        banner={
          <>
            <LiveStatus status={status} />
            {role === 'gm' && (
              <p role="note" className="border-b border-border bg-surface-muted px-5 py-2 text-center text-ui font-medium md:px-8">
                GM editing {character.identity.name || 'this character'}
              </p>
            )}
          </>
        }
        top={
          <>
            <IdentityHeader character={character} catalogue={catalogue} />
            <AbilityRows character={character} derived={derived} />
            <SpeedLine character={character} derived={derived} />
            {canEdit && <DamagePad dispatch={send} />}
          </>
        }
        history={
          <HistoryList key={document.id} characterId={document.id} refreshKey={`${document.revision}:${pending}`} canEdit={canEdit} onUndo={undoEvent} />
        }
      />
      <UndoChip offer={shownOffer} notice={notice} onUndo={undoEvent} onExpire={expire} onDismissNotice={dismissNotice} />
    </>
  )
}
