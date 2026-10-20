import { useEffect } from 'react'
import { Button } from '@heartrush/ui/components/button'
import type { Notice } from './use-character'

/** How long the undo chip stays after a saved action (design: 8 seconds). */
export const UNDO_CHIP_MS = 8000

/** The chip after a saved action: its words, the event Undo reverts (the saved action's stamped id) and the revision that save produced. */
export type UndoOffer = { eventId: string; text: string; revision: number }

/**
 * The one chip above the bottom tab bar. A failure notice ("Couldn't apply: …", "Not saved — no connection") wins
 * over the undo offer and stays until dismissed or the next change; the undo offer hides itself after 8 seconds
 * (`onExpire`), or when a newer offer replaces it.
 */
export function UndoChip({
  offer,
  notice,
  onUndo,
  onExpire,
  onDismissNotice,
}: {
  offer: UndoOffer | null
  notice: Notice | null
  onUndo: (eventId: string) => void
  onExpire: () => void
  onDismissNotice: () => void
}) {
  useEffect(() => {
    if (!offer) return
    const timer = setTimeout(onExpire, UNDO_CHIP_MS)
    return () => clearTimeout(timer)
  }, [offer, onExpire])

  if (!notice && !offer) return <div role="status" aria-live="polite" className="sr-only" />
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:bottom-6">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex max-w-md min-w-0 items-center gap-2 rounded-md bg-foreground py-1 pr-1 pl-4 font-sans text-ui text-background shadow-overlay"
      >
        <span className="min-w-0 flex-1 py-2">{notice ? notice.text : offer!.text}</span>
        {notice ? (
          <Button type="button" variant="ghost" className="min-h-11 shrink-0 text-background hover:bg-background/15 hover:text-background" onClick={onDismissNotice}>
            Dismiss
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 font-semibold text-background underline underline-offset-4 hover:bg-background/15 hover:text-background"
            onClick={() => onUndo(offer!.eventId)}
          >
            Undo
          </Button>
        )}
      </div>
    </div>
  )
}
