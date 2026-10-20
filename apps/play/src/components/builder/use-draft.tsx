// The builder's draft (ruling 8). The builder edits `BuilderInput` (steps 1–5) and `pending` (the step 6–7 actions)
// on screen at once; every change is saved with `saveDraft` after a short pause (the only write without an event,
// INV-ACTION). Saves run one at a time, each with the revision the last save returned.
//
// Conflicts are handled the way the sheet's dispatcher handles them (`components/sheet/use-character.ts`): the screen
// keeps the changes made here that have not saved yet, in order. A conflict (another tab saved the draft first)
// returns the server's draft; that draft is the truth, this screen's unsaved changes are reapplied on top of it, the
// result is shown, and it is sent again, once. A change made in another tab is never written over by this one's stale copy.
//
// Leaving the builder (a site link, Back to another page, closing the tab) waits for unsaved changes to save. When the
// save fails the router blocks the navigation and `leaving` asks the player to stay or leave without saving.
//
// `preview` is the character the engine computes from the draft (`previewDraft`), or the reason it cannot yet: a
// builder whose steps are incomplete is refused by `createCharacter`, which is expected until step 5 is done.
import { useBlocker, type ShouldBlockFn } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { BuilderInput, ClientAction } from '@heartrush/rules-engine/types'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { saveDraftFn, type CharacterDoc, type CharacterResult, type SaveDraftInput } from '~/server/characters'
import { NO_CONNECTION_TEXT, refusalReason } from '~/components/sheet/refusal-text'
import { computePreview, type DraftContent, type DraftPreview } from './draft-rules'

// ---- Shared form pieces -------------------------------------------------------------------------

export const labelClass = 'text-ui font-medium text-foreground'
export const selectClass =
  'h-11 w-full rounded-md border border-input bg-surface px-3 font-sans text-base text-foreground md:text-ui disabled:cursor-not-allowed disabled:opacity-50'

/** A labelled control with an optional hint under it. */
export function Field({ label, htmlFor, hint, children }: { label: ReactNode; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className="text-meta text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ---- The hook -----------------------------------------------------------------------------------

export const SAVE_DELAY_MS = 600

export type SaveStatus =
  | { kind: 'saved' }
  | { kind: 'saving' }
  /** Changed on screen, waiting for the pause before saving. */
  | { kind: 'unsaved' }
  /** The last save failed; `text` says why. The next change (or `flush`) tries again. */
  | { kind: 'failed'; text: string }

export type UseDraft = {
  id: string
  builder: BuilderInput
  pending: ClientAction[]
  /** The revision of the last successful save. */
  revision: number
  status: SaveStatus
  preview: DraftPreview
  /** Changes steps 1–5. Saved after a pause. */
  update(change: Partial<BuilderInput> | ((builder: BuilderInput) => BuilderInput)): void
  /** Changes the step 6–7 actions (B1b). Saved after a pause. */
  setPending(change: ClientAction[] | ((pending: ClientAction[]) => ClientAction[])): void
  /** Saves now. Resolves with the saved document, or null when the save failed (`status` says why). */
  flush(): Promise<CharacterDoc | null>
  /** Set while a navigation away from the builder is held because unsaved changes failed to save. */
  leaving: { stay(): void; leave(): void } | null
}

const isResult = (r: unknown): r is CharacterResult => typeof r === 'object' && r !== null && typeof (r as { ok?: unknown }).ok === 'boolean'

// ---- The saver (pure; the hook below wraps it for React) ------------------------------------------

/** One change made on this screen, kept until it saves so it can be reapplied to another tab's draft after a conflict. */
type Edit = (content: DraftContent) => DraftContent

export type DraftSnapshot = DraftContent & { revision: number; status: SaveStatus }

export type DraftSaver = {
  snapshot(): DraftSnapshot
  subscribe(listener: () => void): () => void
  /** Applies a change on screen and saves it after `SAVE_DELAY_MS`. */
  edit(change: Edit): void
  /** True while a change made here has not saved. */
  dirty(): boolean
  flush(): Promise<CharacterDoc | null>
  dispose(): void
}

const contentOf = (doc: CharacterDoc): DraftContent => {
  if (!doc.state.draft) throw new Error('useDraft needs a draft')
  return { builder: doc.state.builder, pending: doc.state.pending }
}

/** `save` is `saveDraftFn`; a call that rejects is a failed request. */
export function createDraftSaver(initial: CharacterDoc, save: (input: SaveDraftInput) => Promise<unknown>): DraftSaver {
  let saved = initial
  // The changes made here since the last save, oldest first; the screen shows them applied to `saved`.
  let edits: Edit[] = []
  let shown = contentOf(initial)
  let status: SaveStatus = { kind: 'saved' }
  let snap: DraftSnapshot = { ...shown, revision: saved.revision, status }
  let running: Promise<CharacterDoc | null> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()

  const emit = (next: SaveStatus = status) => {
    status = next
    snap = { ...shown, revision: saved.revision, status }
    for (const l of listeners) l()
  }

  async function send(): Promise<CharacterDoc | null> {
    let retriedConflict = false
    while (edits.length > 0) {
      const sent = edits.length
      emit({ kind: 'saving' })
      let result: unknown
      try {
        result = await save({ characterId: initial.id, revision: saved.revision, ...shown })
      } catch {
        result = null
      }
      if (!isResult(result) || (!result.ok && result.status >= 500)) {
        emit({ kind: 'failed', text: NO_CONNECTION_TEXT })
        return null
      }
      if (result.ok) {
        // The server holds what was sent; changes made during the request stay on screen and go next.
        saved = result.character
        edits = edits.slice(sent)
        retriedConflict = false
        continue
      }
      if (result.code === 'conflict' && result.character?.state.draft) {
        // Another tab saved first. Its draft is the truth; this screen's unsaved changes go on top of it and are sent
        // again, once. A second conflict shows the rebased draft and waits for Retry (or the next change).
        saved = result.character
        shown = edits.reduce((content, e) => e(content), contentOf(saved))
        if (!retriedConflict) {
          retriedConflict = true
          continue
        }
      }
      emit({ kind: 'failed', text: `Not saved: ${refusalReason(result.code, result.message)}` })
      return null
    }
    emit({ kind: 'saved' })
    return saved
  }

  const flush = (): Promise<CharacterDoc | null> => {
    if (timer) clearTimeout(timer)
    timer = null
    // One save at a time: a flush during a save waits for it, then saves whatever changed meanwhile.
    const run = (running ?? Promise.resolve(null)).then(() => send())
    running = run
    void run.finally(() => {
      if (running === run) running = null
    })
    return run
  }

  return {
    snapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    edit(change) {
      edits.push(change)
      shown = change(shown)
      emit({ kind: 'unsaved' })
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    dirty: () => edits.length > 0,
    flush,
    dispose() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}

// ---- The hook -----------------------------------------------------------------------------------

export function useDraft(initial: CharacterDoc): UseDraft {
  const save = useServerFn(saveDraftFn)
  const saveRef = useRef(save)
  saveRef.current = save
  const [saver] = useState(() => createDraftSaver(initial, (data) => saveRef.current({ data })))
  const { builder, pending, revision, status } = useSyncExternalStore(saver.subscribe, saver.snapshot, saver.snapshot)

  const update = useCallback<UseDraft['update']>(
    (change) => saver.edit((d) => ({ ...d, builder: typeof change === 'function' ? change(d.builder) : { ...d.builder, ...change } })),
    [saver],
  )
  const setPending = useCallback<UseDraft['setPending']>(
    (change) => saver.edit((d) => ({ ...d, pending: typeof change === 'function' ? change(d.pending) : change })),
    [saver],
  )

  // Leaving the builder (any navigation to another path, or closing the tab) is held while a change is unsaved:
  // a site link waits for the save, and stays blocked, asking, when it fails. Step changes stay on this path.
  const shouldBlockFn = useCallback<ShouldBlockFn>(
    async ({ current, next }) => current.pathname !== next.pathname && saver.dirty() && (await saver.flush()) === null,
    [saver],
  )
  const enableBeforeUnload = useCallback(() => saver.dirty(), [saver])
  const blocker = useBlocker({ shouldBlockFn, enableBeforeUnload, withResolver: true })
  const leaving = blocker.status === 'blocked' ? { stay: blocker.reset, leave: blocker.proceed } : null

  // A phone that switches away mid-pause still saves.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && saver.dirty()) void saver.flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      saver.dispose()
    }
  }, [saver])

  const preview = useMemo(() => computePreview(builder, pending), [builder, pending])

  return { id: initial.id, builder, pending, revision, status, preview, update, setPending, flush: saver.flush, leaving }
}
