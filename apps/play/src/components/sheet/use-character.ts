// The sheet's one way to change a character (INV-ACTION): `createDispatcher` is the pure, transport-injected core
// and `useCharacter` wraps it for React.
//
// A client action is stamped with a ULID `id` and an ISO `at` (INV-DET), applied to the document with the rules
// engine at once (optimistic), and sent with the revision the client last saw. The server's result is the truth:
//  - saved:    the server's document replaces the optimistic one;
//  - conflict: the server returns its current document; the one in-flight action (same id, same `at`) is applied to
//              it and sent again, once;
//  - refusal:  the rules (or authorization) said no; the document goes back to the last saved one and the reason is
//              plain words (`refusal-text.ts`);
//  - network error or 5xx: same revert, with "Not saved — no connection". Nothing is queued for later.
// Changes made while one is in flight are applied on screen immediately and sent one at a time, in order; if one of
// them fails, the ones behind it are cancelled, because they were built on a state that never saved.
//
// INV-DERIVED: nothing derived is ever sent. `derived` on the document is data for the UI: the server's bundle after
// a save, and the same engine functions recomputed locally for the optimistic document.
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { applyAction } from '@heartrush/rules-engine/actions'
import type { ActionCatalogue } from '@heartrush/rules-engine/actions'
import { RuleError, type Character, type ClientAction } from '@heartrush/rules-engine/types'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ulid } from 'ulid'
import { getCatalogue } from '../../catalogue'
import {
  applyCharacterActionFn, deriveCharacter, undoCharacterEventFn,
  type ApplyInput, type CharacterDoc, type CharacterResult, type Derived, type UndoInput,
} from '../../server/characters'
import { NO_CONNECTION_TEXT, refusalText } from './refusal-text'

// ---- Types -------------------------------------------------------------------------------------

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** What the UI hands to `dispatch`: an action without its `id` and `at`, which the dispatcher stamps. */
export type ActionDraft = DistributiveOmit<ClientAction, 'id' | 'at'>

/** The two server calls, injected. A call that rejects is a failed request (network, 5xx, signed out). */
export type Transport = {
  apply(input: ApplyInput): Promise<CharacterResult>
  undo(input: UndoInput): Promise<CharacterResult>
}

export type Outcome =
  /** `character` is the server's document (with its `derived` bundle). `rebased`: it went through after a conflict. */
  | { status: 'saved'; character: CharacterDoc; action: ClientAction | null; rebased: boolean }
  /** The rules or authorization refused it. `character` is the document to show: the last saved one, or the server's newer one after a conflict. */
  | { status: 'refused'; code: string; message: string; text: string; character: CharacterDoc; action: ClientAction | null }
  /** The request failed, or an earlier change failed first. `character` is the last saved document. */
  | { status: 'unsaved'; text: string; character: CharacterDoc; action: ClientAction | null }

export type DispatcherOptions = {
  transport: Transport
  catalogue: ActionCatalogue
  /** Recomputes derived values for an optimistic document (`deriveCharacter` with the catalogue). */
  derive: (character: Character) => Derived
  /** ULID source and ISO clock; tests replace them. */
  newId?: () => string
  now?: () => string
}

export type Dispatcher = {
  /** The document to show: the last saved one with the unsaved actions applied. */
  document(): CharacterDoc
  /** True while any change is waiting for the server. */
  pending(): boolean
  subscribe(listener: () => void): () => void
  /** Stamps, applies on screen and sends. Resolves when the server has answered (or the engine refused it before sending). */
  dispatch(action: ActionDraft): Promise<Outcome>
  /** Undoes the character's top event on the server. The server's document replaces the screen's. */
  undo(eventId: string): Promise<Outcome>
  /** A newer document from the page's loader (after a focus refetch or a live event). Ignored when not newer or while writes are pending. */
  adopt(document: CharacterDoc): void
}

export const FAILED_BEFORE_TEXT = 'Not saved — a change before it failed'

// ---- The dispatcher ----------------------------------------------------------------------------

const isResult = (r: unknown): r is CharacterResult => typeof r === 'object' && r !== null && typeof (r as { ok?: unknown }).ok === 'boolean'

/** A request that failed: it threw, answered something that is not a result, or answered a 5xx. */
const isFailure = (r: unknown): boolean => !isResult(r) || (!r.ok && r.status >= 500)

export function createDispatcher(initial: CharacterDoc, options: DispatcherOptions): Dispatcher {
  const { transport, catalogue, derive } = options
  const newId = options.newId ?? ulid
  const now = options.now ?? (() => new Date().toISOString())
  if (initial.state.draft) throw new Error('A draft is edited through the builder, not the sheet dispatcher')

  let saved: CharacterDoc = initial
  let shown: CharacterDoc = initial
  // Actions applied on screen and not yet saved, oldest first.
  let unsaved: ClientAction[] = []
  // Bumped when a write fails: sends queued before that were built on a state that never saved.
  let generation = 0
  let chain: Promise<unknown> = Promise.resolve()
  // Undo requests waiting for the server.
  let undoing = 0
  const listeners = new Set<() => void>()

  const emit = () => { for (const l of listeners) l() }
  const characterOf = (doc: CharacterDoc): Character => {
    if (doc.state.draft) throw new Error('A draft is edited through the builder, not the sheet dispatcher')
    return doc.state
  }

  /** `doc` with `action` applied: the engine's state, recomputed derived values, one revision ahead. Throws `RuleError`. */
  function applyTo(doc: CharacterDoc, action: ClientAction): CharacterDoc {
    const { character } = applyAction(characterOf(doc), action, catalogue)
    return { ...doc, state: character, name: character.identity.name, derived: derive(character), revision: doc.revision + 1, updatedAt: action.at }
  }

  /** The last saved document with every unsaved action applied; one the rules now refuse is dropped. */
  function rebuild(): void {
    let doc = saved
    const kept: ClientAction[] = []
    for (const a of unsaved) {
      try {
        doc = applyTo(doc, a)
        kept.push(a)
      } catch (e) {
        if (!(e instanceof RuleError)) throw e
      }
    }
    unsaved = kept
    shown = doc
  }

  function settle(): void {
    if (unsaved.length === 0) shown = saved
    else rebuild()
    emit()
  }

  const refused = (r: { code: string; message: string; character?: CharacterDoc }, action: ClientAction | null, doing: 'apply' | 'undo'): Outcome => ({
    status: 'refused', code: r.code, message: r.message, text: refusalText(r.code as never, r.message, doing), character: r.character ?? saved, action,
  })

  /** Runs `step` after every earlier write has finished. */
  function enqueue<T>(step: () => Promise<T>): Promise<T> {
    const run = chain.then(step, step)
    chain = run.catch(() => undefined)
    return run
  }

  async function send(action: ClientAction, sentIn: number): Promise<Outcome> {
    if (sentIn !== generation) {
      unsaved = unsaved.filter((a) => a.id !== action.id)
      settle()
      return { status: 'unsaved', text: FAILED_BEFORE_TEXT, character: saved, action }
    }
    const fail = (outcome: Outcome): Outcome => {
      generation++
      unsaved = [] // the changes queued behind this one were built on a state that never saved
      if (outcome.status !== 'saved') saved = outcome.character.revision >= saved.revision ? outcome.character : saved
      settle()
      return outcome
    }
    const attempt = async (revision: number): Promise<CharacterResult | null> => {
      try {
        const r = await transport.apply({ characterId: saved.id, revision, action })
        return isFailure(r) ? null : r
      } catch {
        return null
      }
    }

    let result = await attempt(saved.revision)
    if (!result) return fail({ status: 'unsaved', text: NO_CONNECTION_TEXT, character: saved, action })
    let rebased = false
    if (!result.ok && result.code === 'conflict' && result.character) {
      // Someone else wrote first. Their document is the truth; the one in-flight action goes on top of it, same id.
      const theirs = result.character
      try {
        applyTo(theirs, action) // the rules may refuse it on their document (e.g. not enough rush points now): then it is not sent
      } catch (e) {
        if (!(e instanceof RuleError)) throw e
        return fail(refused({ code: e.code, message: e.message, character: theirs }, action, 'apply'))
      }
      result = await attempt(theirs.revision)
      if (!result) return fail({ status: 'unsaved', text: NO_CONNECTION_TEXT, character: theirs, action })
      rebased = true
    }
    if (!result.ok) return fail(refused(result, action, 'apply'))
    saved = result.character
    unsaved = unsaved.filter((a) => a.id !== action.id)
    settle()
    return { status: 'saved', character: result.character, action, rebased }
  }

  return {
    document: () => shown,
    pending: () => unsaved.length > 0 || undoing > 0,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    dispatch(draft) {
      const action = { ...draft, id: newId(), at: now() } as ClientAction
      let next: CharacterDoc
      try {
        next = applyTo(shown, action)
      } catch (e) {
        // The rules refuse it on the document as it stands: nothing is applied, nothing is sent.
        if (e instanceof RuleError) return Promise.resolve(refused({ code: e.code, message: e.message, character: shown }, action, 'apply'))
        throw e
      }
      unsaved.push(action)
      shown = next
      emit()
      const sentIn = generation
      return enqueue(() => send(action, sentIn))
    },
    undo(eventId) {
      undoing++
      emit()
      const sentIn = generation
      return enqueue(async (): Promise<Outcome> => {
        try {
          if (sentIn !== generation) return { status: 'unsaved', text: FAILED_BEFORE_TEXT, character: saved, action: null }
          let result: CharacterResult | null
          try {
            const r = await transport.undo({ characterId: saved.id, eventId })
            result = isFailure(r) ? null : r
          } catch {
            result = null
          }
          if (!result) return { status: 'unsaved', text: NO_CONNECTION_TEXT, character: saved, action: null }
          if (!result.ok) {
            if (result.character) saved = result.character
            return refused(result, null, 'undo')
          }
          saved = result.character
          return { status: 'saved', character: result.character, action: null, rebased: false }
        } finally {
          undoing--
          settle()
        }
      })
    },
    adopt(doc) {
      if (doc.id !== saved.id || doc.revision <= saved.revision || unsaved.length > 0 || undoing > 0) return
      if (doc.state.draft) return
      saved = doc
      settle()
    },
  }
}

// ---- The hook ----------------------------------------------------------------------------------

/** What the sheet shows after a change did not save: a refusal's words, or the no-connection text. */
export type Notice = { kind: 'refused' | 'unsaved'; text: string }

export type UseCharacter = {
  /** The document to render: saved state plus any unsaved actions. `state` is a finished `Character`. */
  document: CharacterDoc
  /** The state of the document as a finished character (the sheet never renders a draft). */
  character: Character
  /** Read-only values for the UI: the server's bundle after a save, recomputed with the same engine functions for unsaved changes. Never sent. */
  derived: Derived
  /** The viewer's role on this character (`owner`, `gm` or `player`); only owner and gm may write. */
  role: CharacterDoc['role']
  /** Stamps `id`/`at`, applies on screen, sends. Resolves when the server answered; never rejects for a refusal or a lost connection. */
  dispatch(action: ActionDraft): Promise<Outcome>
  /** Undoes the top event (`EventSummary.id` from `listEventsFn`'s `topEventId`). */
  undo(eventId: string): Promise<Outcome>
  /** True while a change or an undo is waiting for the server. */
  pending: boolean
  /** The last failure, or null; cleared by the next change, by `dismissNotice`, or by a later save. */
  notice: Notice | null
  dismissNotice(): void
}

/**
 * The sheet's hook. `initial` is the route loader's `CharacterDoc` for a finished character; when the loader hands
 * a newer revision (after a focus refetch or a live event) it replaces the saved document, unless changes are in
 * flight. The window regaining focus invalidates the router, which re-runs the loader.
 */
export function useCharacter(initial: CharacterDoc): UseCharacter {
  const router = useRouter()
  const apply = useServerFn(applyCharacterActionFn)
  const undoFn = useServerFn(undoCharacterEventFn)
  const transport = useRef<Transport>(null as never)
  transport.current = {
    apply: (data) => apply({ data }) as Promise<CharacterResult>,
    undo: (data) => undoFn({ data }) as Promise<CharacterResult>,
  }

  const [dispatcher, setDispatcher] = useState(() => build(initial, transport))
  // A different character (route param change) gets a new dispatcher.
  const current = dispatcher.document().id === initial.id ? dispatcher : null
  useEffect(() => {
    if (!current) setDispatcher(build(initial, transport))
    else current.adopt(initial)
  }, [initial, current])
  const active = current ?? dispatcher

  const document = useSyncExternalStore(active.subscribe, active.document, active.document)
  const pending = useSyncExternalStore(active.subscribe, active.pending, active.pending)

  const [notice, setNotice] = useState<Notice | null>(null)
  const report = useCallback((o: Outcome): Outcome => {
    if (o.status === 'refused') setNotice({ kind: 'refused', text: o.text })
    else if (o.status === 'unsaved') setNotice({ kind: 'unsaved', text: o.text })
    return o
  }, [])
  const dispatch = useCallback((action: ActionDraft) => { setNotice(null); return active.dispatch(action).then(report) }, [active, report])
  const undo = useCallback((eventId: string) => { setNotice(null); return active.undo(eventId).then(report) }, [active, report])
  const dismissNotice = useCallback(() => setNotice(null), [])

  useEffect(() => {
    const onFocus = () => { void router.invalidate() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [router])

  return {
    document,
    character: document.state as Character,
    derived: document.derived as Derived,
    role: document.role,
    dispatch,
    undo,
    pending,
    notice,
    dismissNotice,
  }
}

function build(initial: CharacterDoc, transport: { current: Transport }): Dispatcher {
  const catalogue = getCatalogue()
  return createDispatcher(initial, {
    catalogue,
    derive: (character) => deriveCharacter(character, catalogue),
    // Reads the latest server-function wrappers on each call.
    transport: { apply: (i) => transport.current.apply(i), undo: (i) => transport.current.undo(i) },
  })
}
