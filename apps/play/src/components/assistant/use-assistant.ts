// The creation assistant's client state (design "Client (`use-assistant.ts`)"). The chat lives in D1 (`builder_chat`);
// this hook shows it and drives it through the three server functions. On mount it reads the chat once; while a run is
// in flight it waits on it with `getChat({wait: true})` in a loop (a network error waits 4 s and tries again), which is
// how a reload or a second tab adopts the run or its settled result. `send` saves the builder first (the run reads the
// stored draft), shows the player's message at once and starts the run; a `busy` answer means another tab's run holds
// the chat, so this one adopts it. The unread dots are client state only.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { ulid } from 'ulid'
import type { PlayerMessage, StoredMessage } from '~/assistant/schema'
import type { UseDraft } from '~/components/builder/use-draft'
import { getChatFn, sendChatFn, stopChatFn, type ChatError, type ChatFailure, type ChatState, type StopResult } from '~/server/assistant'

const RETRY_AFTER_MS = 4000

/** Which side of the builder page is on screen: one tab of two below 1024 px, or both columns. */
export type AssistantShowing = 'builder' | 'assistant' | 'both'

/** Why the last send got no run, when the server never stored a run error for it. */
export type SendProblem =
  | { kind: 'unreachable' }
  /** `draft.flush()` failed, so the run would have read an old draft; nothing was sent. */
  | { kind: 'unsaved' }
  | { kind: 'bad_input'; message: string }

export type UseAssistant = {
  /** The stored chat, plus the player's just-sent message until the server has stored it. */
  messages: StoredMessage[]
  /** Set after the first `getChat` answers (immediately on `/characters/new`, where there is no chat yet). */
  loaded: boolean
  /** When the run in flight started (ms), or null. */
  running: { since: number } | null
  stopping: boolean
  /** The last Stop could not be confirmed; the run may still be going and Stop is offered again. */
  stopUnconfirmed: boolean
  /** Why the last run gave no turn (`stopped` included), from the server. */
  error: ChatError | null
  sendProblem: SendProblem | null
  /** A chat function answered `not_found`: not the player's draft, finished, or gone. */
  notFound: boolean
  /** A dot on a tab that is not showing: a reply arrived (assistant), or Apply changed the draft (builder). */
  unread: { assistant: boolean; builder: boolean }
  /** Resolves false when nothing was sent (the Composer puts the text back). */
  send(text: string): Promise<boolean>
  stop(): Promise<void>
  /** Runs the stored last player message again (after a failure or Stop), or resends a message the server never got. */
  retry(): Promise<void>
  /** Called by the proposal card after Apply wrote to the draft. */
  noteApplied(): void
}

export type UseAssistantOptions = {
  /** The draft whose chat this is; null on `/characters/new` before a draft exists. */
  characterId: string | null
  /** The builder's draft, flushed before every send; null on `/characters/new` before a draft exists. */
  draft: UseDraft | null
  showing: AssistantShowing
  /**
   * Required when `characterId` is null: creates the draft and resolves to its id (null when it could not, and nothing
   * is sent). `/characters/new` passes `createDraftFn` with the step 1 fields here.
   */
  createDraft?: () => Promise<string | null>
  /** Called once the first message for a draft made by `createDraft` has been sent (whatever the outcome), with its id. */
  afterFirstSend?: (characterId: string) => void
}

const isState = (r: unknown): r is ChatState | ChatFailure =>
  typeof r === 'object' && r !== null && typeof (r as { ok?: unknown }).ok === 'boolean'

const isStop = (r: unknown): r is StopResult => isState(r)

export function useAssistant({ characterId, draft, showing, createDraft, afterFirstSend }: UseAssistantOptions): UseAssistant {
  const getChat = useServerFn(getChatFn)
  const sendChat = useServerFn(sendChatFn)
  const stopChat = useServerFn(stopChatFn)

  const [chat, setChat] = useState<ChatState | null>(null)
  const [pending, setPending] = useState<PlayerMessage | null>(null)
  /** When this page's `sendChat` went out (ms), while it is in flight. */
  const [sending, setSending] = useState<number | null>(null)
  const [stopping, setStopping] = useState(false)
  const [stopUnconfirmed, setStopUnconfirmed] = useState(false)
  const [sendProblem, setSendProblem] = useState<SendProblem | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [unread, setUnread] = useState({ assistant: false, builder: false })

  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const latest = useRef({ draft, createDraft, afterFirstSend, showing })
  latest.current = { draft, createDraft, afterFirstSend, showing }

  /** Takes one server answer; false when the answer was not a chat (a redirect, an error page). */
  const adopt = useCallback((r: unknown): boolean => {
    if (!live.current || !isState(r)) return false
    if (r.ok) {
      setChat(r)
      setPending((p) => (p && r.messages.some((m) => m.id === p.id) ? null : p))
      return true
    }
    if (r.code === 'not_found') setNotFound(true)
    else if (r.code === 'bad_input') setSendProblem({ kind: 'bad_input', message: r.message })
    return true
  }, [])

  // First read.
  useEffect(() => {
    if (!characterId) return
    void getChat({ data: { characterId, wait: false } }).then(adopt, () => live.current && setSendProblem({ kind: 'unreachable' }))
  }, [characterId, getChat, adopt])

  // While a run is in flight (and this page is not mid-send), wait on it.
  const waiting = characterId !== null && sending === null && chat?.running != null
  useEffect(() => {
    if (!waiting || !characterId) return
    let stop = false
    void (async () => {
      while (!stop && live.current) {
        let r: unknown
        try {
          r = await getChat({ data: { characterId, wait: true } })
        } catch {
          await new Promise((res) => setTimeout(res, RETRY_AFTER_MS))
          continue
        }
        if (stop) return
        adopt(r)
        // The loop ends when the answer is no longer running (this effect is torn down and not restarted).
        if (!isState(r) || !r.ok || !r.running) return
      }
    })()
    return () => {
      stop = true
    }
  }, [waiting, characterId, getChat, adopt])

  // A reply that arrives while Builder shows puts a dot on Assistant.
  const assistantCount = chat?.messages.filter((m) => m.role === 'assistant').length ?? null
  const seen = useRef<number | null>(null)
  useEffect(() => {
    if (assistantCount === null) return
    if (seen.current !== null && assistantCount > seen.current && latest.current.showing === 'builder') setUnread((u) => ({ ...u, assistant: true }))
    seen.current = assistantCount
  }, [assistantCount])

  // Showing a tab clears its dot.
  useEffect(() => {
    if (showing === 'assistant' || showing === 'both') setUnread((u) => (u.assistant ? { ...u, assistant: false } : u))
    if (showing === 'builder' || showing === 'both') setUnread((u) => (u.builder ? { ...u, builder: false } : u))
  }, [showing])

  const deliver = useCallback(
    async (id: string, message: PlayerMessage | null): Promise<void> => {
      setSending(Date.now())
      try {
        const r = await sendChat({ data: message ? { characterId: id, message: { id: message.id, text: message.text } } : { characterId: id, retry: true } })
        if (isState(r) && !r.ok && r.code === 'busy') {
          // Another tab's run holds the chat: show it and wait on it.
          adopt(await getChat({ data: { characterId: id, wait: false } }))
        } else adopt(r)
      } catch {
        if (live.current) setSendProblem({ kind: 'unreachable' })
      } finally {
        if (live.current) setSending(null)
      }
    },
    [sendChat, getChat, adopt],
  )

  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      const text = raw.trim()
      if (!text || sending !== null || chat?.running) return false
      setSendProblem(null)
      setStopUnconfirmed(false)
      const { draft: d, createDraft: create, afterFirstSend: after } = latest.current
      let id = characterId
      if (!id) {
        if (!create) throw new Error('useAssistant: createDraft is required before a draft exists')
        id = await create()
        if (!id) return false
      } else if (d && (await d.flush()) === null) {
        setSendProblem({ kind: 'unsaved' })
        return false
      }
      const message: PlayerMessage = { id: ulid(), role: 'player', text, at: new Date().toISOString() }
      setPending(message)
      setChat((c) => (c ? { ...c, error: null } : c))
      await deliver(id, message)
      if (!characterId) after?.(id)
      return true
    },
    [characterId, sending, chat?.running, deliver],
  )

  const retry = useCallback(async () => {
    if (!characterId) return
    setSendProblem(null)
    setStopUnconfirmed(false)
    const d = latest.current.draft
    if (d && (await d.flush()) === null) return setSendProblem({ kind: 'unsaved' })
    // A message the server never stored goes again with the same id; otherwise the stored last message is run again.
    await deliver(characterId, pending)
  }, [characterId, pending, deliver])

  const stop = useCallback(async () => {
    if (!characterId) return
    setStopping(true)
    setStopUnconfirmed(false)
    try {
      const r: unknown = await stopChat({ data: { characterId } })
      if (isStop(r)) {
        if (!r.ok) adopt(r)
        else if (!r.stopped) setStopUnconfirmed(true)
      }
      adopt(await getChat({ data: { characterId, wait: false } }))
    } catch {
      if (live.current) setStopUnconfirmed(true)
    } finally {
      if (live.current) setStopping(false)
    }
  }, [characterId, stopChat, getChat, adopt])

  const noteApplied = useCallback(() => {
    if (latest.current.showing === 'assistant') setUnread((u) => ({ ...u, builder: true }))
  }, [])

  const stored = chat?.messages ?? []
  const messages = pending && !stored.some((m) => m.id === pending.id) ? [...stored, pending] : stored
  const startedAt = chat?.running ? Date.parse(chat.running.startedAt) : null
  const since = sending ?? startedAt
  const running = since !== null ? { since } : null

  return {
    messages,
    loaded: characterId === null || chat !== null || notFound,
    running,
    stopping,
    stopUnconfirmed,
    error: sending !== null ? null : (chat?.error ?? null),
    sendProblem,
    notFound,
    unread,
    send,
    stop,
    retry,
    noteApplied,
  }
}

/** Whole seconds since `since`, ticking once a second while it is set (copied from the tools encounter builder). */
export function useElapsed(since: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (since === null) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [since])
  return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000))
}
