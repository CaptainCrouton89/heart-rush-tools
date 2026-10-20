// `/characters/$id/edit`: everything about a character that is not a one-tap play action — identity, gear,
// professions and notes. The `$id_` file name keeps this page out of the sheet route's tree (the sheet renders no
// <Outlet/>); the URL is unchanged.
import { useCallback, useRef, useState, type MouseEvent } from 'react'
import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import type { CharacterDoc } from '~/server/characters'
import { getCharacterFn } from '~/server/characters'
import { getCatalogue } from '~/catalogue'
import { useCampaignLive } from '~/components/live/use-live'
import { GearEditor } from '~/components/edit/GearEditor'
import { IdentityEditor } from '~/components/edit/IdentityEditor'
import { NotesEditor } from '~/components/edit/NotesEditor'
import { ProfessionsEditor } from '~/components/edit/ProfessionsEditor'
import { EditBlock } from '~/components/edit/fields'
import { describeAction } from '~/components/sheet/HistoryList'
import { UndoChip, type UndoOffer } from '~/components/sheet/UndoChip'
import { useCharacter, type ActionDraft, type Outcome } from '~/components/sheet/use-character'

export const Route = createFileRoute('/characters/$id_/edit')({
  loader: async ({ params }): Promise<CharacterDoc> => {
    const result = await getCharacterFn({ data: { characterId: params.id } })
    // 403 and 404 both read as "not found", as on the sheet.
    if (!result.ok) throw notFound()
    if (result.character.state.draft) throw redirect({ href: `/characters/${params.id}/build` })
    return result.character
  },
  head: ({ loaderData }) => ({ meta: [{ title: `Edit ${loaderData?.name || 'character'} · Heart Rush Play` }] }),
  component: EditPage,
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

const BLOCKS = [
  { id: 'identity', label: 'Identity' },
  { id: 'gear', label: 'Gear' },
  { id: 'professions', label: 'Professions' },
  { id: 'notes', label: 'Notes' },
] as const

function EditPage() {
  const initial = Route.useLoaderData()
  const { document, character, role, dispatch, undo, pending, notice, dismissNotice } = useCharacter(initial)
  useCampaignLive(document.campaignId)
  const catalogue = getCatalogue()
  const canEdit = role === 'owner' || role === 'gm'
  const sheetHref = `/characters/${encodeURIComponent(document.id)}`
  const name = character.identity.name || 'this character'

  const [offer, setOffer] = useState<UndoOffer | null>(null)
  const expire = useCallback(() => setOffer(null), [])
  // Writes run in order, so the latest one settling means every earlier one has too.
  const latest = useRef<Promise<Outcome> | null>(null)
  // As on the sheet: every change is one action, and a saved one raises the undo chip.
  const send = useCallback(
    async (action: ActionDraft): Promise<Outcome> => {
      const sent = dispatch(action)
      latest.current = sent
      const outcome = await sent
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
  const shownOffer = offer && !pending && offer.revision === document.revision ? offer : null
  // Fields save on blur. Done blurs the focused field (its save starts synchronously), waits for the writes still
  // running, and stays on the page when one of them did not save, so the undo chip can say why.
  const done = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const before = latest.current
    const focused = globalThis.document.activeElement
    if (focused instanceof HTMLElement) focused.blur()
    if (pending || latest.current !== before) {
      const outcome = await latest.current
      if (outcome && outcome.status !== 'saved') return
    }
    window.location.assign(sheetHref)
  }

  if (!canEdit) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 pt-16">
        <h1 className="font-serif text-h2-sm font-semibold">You can't edit {name}</h1>
        <p className="mt-2 text-body-sm text-muted-foreground">Only the character's owner and the campaign's GM can change it.</p>
        <a href={sheetHref} className="mt-4 inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
          Back to the sheet
        </a>
      </div>
    )
  }

  return (
    <>
      <div className="sticky top-14 z-20 border-b border-border bg-surface/95 backdrop-blur md:top-16">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-2 md:px-8">
          <h1 className="min-w-0 truncate font-serif text-h4 font-semibold">Edit {name}</h1>
          <a href={sheetHref} onClick={done} className="inline-flex min-h-11 shrink-0 items-center text-ui font-medium text-primary underline underline-offset-4">
            Done
          </a>
        </div>
        <nav aria-label="Edit sections" className="mx-auto flex w-full max-w-2xl gap-1 overflow-x-auto px-3 md:px-6">
          {BLOCKS.map((b) => (
            <a key={b.id} href={`#${b.id}`} className="inline-flex min-h-11 items-center px-2 text-ui text-muted-foreground hover:text-foreground">
              {b.label}
            </a>
          ))}
        </nav>
      </div>
      {role === 'gm' && (
        <p role="note" className="border-b border-border bg-surface-muted px-5 py-2 text-center text-ui font-medium md:px-8">
          GM editing {name}
        </p>
      )}

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 pt-6 pb-10 md:px-8">
        <EditBlock id="identity" title="Identity">
          <IdentityEditor value={character.identity} onChange={send} />
        </EditBlock>
        <EditBlock id="gear" title="Gear">
          <GearEditor value={character} catalogue={catalogue} onChange={send} />
        </EditBlock>
        <EditBlock id="professions" title="Professions">
          <ProfessionsEditor value={character.professions} onChange={send} />
        </EditBlock>
        <EditBlock id="notes" title="Notes">
          <NotesEditor value={character.notes} onChange={send} />
        </EditBlock>
      </div>

      <UndoChip offer={shownOffer} notice={notice} onUndo={undoEvent} onExpire={expire} onDismissNotice={dismissNotice} />
    </>
  )
}
