// The creation assistant's client state (design "Client (`use-assistant.ts`)"). The chat lives in D1 (`builder_chat`);
// this hook shows it and drives it through the three server functions. It reads the chat on mount and, while a run is in
// flight, waits on it with `getChat({wait: true})` in a loop (a network error waits 4 s and tries again), which is how a
// reload or a second tab adopts the run or its settled result. `send` saves the builder first (the run reads the
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
  /** The player's last message went out but no answer came back: Retry it before sending another (the Composer is off). */
  unsent: boolean
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

  /** The draft whose chat this is: `characterId`, or the draft `createDraft` just made on `/characters/new`. */
  const [chatId, setChatId] = useState(characterId)
  const [chat, setChat] = useState<ChatState | null>(null)
  /** The player's message from this page until the server has stored it (also kept when its send went unanswered). */
  const [pending, setPending] = useState<PlayerMessage | null>(null)
  /** When this page's `sendChat` went out (ms), while it is in flight. */
  const [sending, setSending] = useState<number | null>(null)
  const [stopping, setStopping] = useState(false)
  const [stopUnconfirmed, setStopUnconfirmed] = useState(false)
  const [sendProblem, setSendProblem] = useState<SendProblem | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [unread, setUnread] = useState({ assistant: false, builder: false })

  // Another draft's chat (the route moved to another character): start over for it.
  if (characterId !== null && characterId !== chatId) {
    setChatId(characterId)
    setChat(null)
    setPending(null)
    setSending(null)
    setStopping(false)
    setStopUnconfirmed(false)
    setSendProblem(null)
    setNotFound(false)
    setUnread({ assistant: false, builder: false })
  }

  /** The chat answers are for; an answer for any other draft is dropped. Cleared on unmount. */
  const current = useRef<string | null>(chatId)
  current.current = chatId
  useEffect(() => {
    current.current = chatId
    return () => {
      current.current = null
    }
  }, [chatId])
  /** Set synchronously while a send or retry is under way, so two taps before a render cannot both send. */
  const busy = useRef(false)

  const latest = useRef({ draft, createDraft, afterFirstSend, showing })
  latest.current = { draft, createDraft, afterFirstSend, showing }

  /** Takes one server answer for draft `id`; false when it was not a chat (a redirect, an error page) or is stale. */
  const adopt = useCallback((id: string, r: unknown): boolean => {
    if (current.current !== id || !isState(r)) return false
    if (r.ok) {
      setChat(r)
      setPending((p) => (p && r.messages.some((m) => m.id === p.id) ? null : p))
      return true
    }
    if (r.code === 'not_found') setNotFound(true)
    else if (r.code === 'bad_input') {
      // The server refused the message itself, so it was not stored: it leaves the chat and goes back in the composer.
      setPending(null)
      setSendProblem({ kind: 'bad_input', message: r.message })
    }
    return true
  }, [])

  // Reading the chat: once on mount, then while a run is in flight (and this page is not mid-send) wait on it in a
  // loop. A network error waits 4 s and tries again. Starting a send or moving to another draft cancels the loop, so a
  // read that answers late never replaces what the send brought.
  const reading = chatId !== null && sending === null && !notFound && (chat === null || chat.running !== null)
  useEffect(() => {
    if (!reading || !chatId) return
    let cancelled = false
    void (async () => {
      let wait = false
      while (!cancelled) {
        let r: unknown
        try {
          r = await getChat({ data: { characterId: chatId, wait } })
        } catch {
          await new Promise((res) => setTimeout(res, RETRY_AFTER_MS))
          continue
        }
        if (cancelled || !adopt(chatId, r)) return
        // Ends when the chat is no longer running (this effect is torn down and not restarted).
        if (!isState(r) || !r.ok || !r.running) return
        wait = true
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reading, chatId, getChat, adopt])

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

  /** Sends `message` (or, with null, runs the stored last message again); false when the server did not take the message. */
  const deliver = useCallback(
    async (id: string, message: PlayerMessage | null): Promise<boolean> => {
      setSending(Date.now())
      try {
        const r = await sendChat({ data: message ? { characterId: id, message: { id: message.id, text: message.text } } : { characterId: id, retry: true } })
        if (isState(r) && !r.ok && r.code === 'busy') {
          // Another tab's run holds the chat and this message was not stored: it goes back in the composer, and this
          // page shows that run and waits on it.
          if (current.current === id) setPending(null)
          adopt(id, await getChat({ data: { characterId: id, wait: false } }))
          return false
        }
        adopt(id, r)
        return !(isState(r) && !r.ok && r.code === 'bad_input')
      } catch {
        if (current.current !== id) return true
        // No answer: the server may have stored the message and started its run anyway. Read the chat to find out;
        // until it shows the message, the message stays on screen with its id, so Retry resends it and the server will
        // not store it twice.
        setSendProblem({ kind: 'unreachable' })
        try {
          const r = await getChat({ data: { characterId: id, wait: false } })
          if (adopt(id, r) && message && isState(r) && r.ok && r.messages.some((m) => m.id === message.id)) setSendProblem(null)
        } catch {
          // Still unreachable: Retry is the way on.
        }
        return true
      } finally {
        if (current.current === id) setSending(null)
      }
    },
    [sendChat, getChat, adopt],
  )

  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      const text = raw.trim()
      // A message whose send went unanswered must be retried before another one goes.
      if (!text || busy.current || chat?.running || pending) return false
      busy.current = true
      try {
        setSendProblem(null)
        setStopUnconfirmed(false)
        const { draft: d, createDraft: create, afterFirstSend: after } = latest.current
        let id = chatId
        if (!id) {
          if (!create) throw new Error('useAssistant: createDraft is required before a draft exists')
          id = await create()
          if (!id) return false
          current.current = id
          setChatId(id)
        } else if (d && (await d.flush()) === null) {
          setSendProblem({ kind: 'unsaved' })
          return false
        }
        const message: PlayerMessage = { id: ulid(), role: 'player', text, at: new Date().toISOString() }
        setPending(message)
        setChat((c) => (c ? { ...c, error: null } : c))
        const accepted = await deliver(id, message)
        if (!chatId) after?.(id)
        return accepted
      } finally {
        busy.current = false
      }
    },
    [chatId, chat?.running, pending, deliver],
  )

  const retry = useCallback(async () => {
    if (!chatId || busy.current) return
    busy.current = true
    try {
      setSendProblem(null)
      setStopUnconfirmed(false)
      const d = latest.current.draft
      if (d && (await d.flush()) === null) return setSendProblem({ kind: 'unsaved' })
      // A message the server never stored goes again with the same id; otherwise the stored last message is run again.
      await deliver(chatId, pending)
    } finally {
      busy.current = false
    }
  }, [chatId, pending, deliver])

  const stop = useCallback(async () => {
    if (!chatId) return
    setStopping(true)
    setStopUnconfirmed(false)
    try {
      const r: unknown = await stopChat({ data: { characterId: chatId } })
      if (current.current !== chatId) return
      if (isStop(r)) {
        if (!r.ok) adopt(chatId, r)
        else if (!r.stopped) setStopUnconfirmed(true)
      }
      adopt(chatId, await getChat({ data: { characterId: chatId, wait: false } }))
    } catch {
      if (current.current === chatId) setStopUnconfirmed(true)
    } finally {
      if (current.current === chatId) setStopping(false)
    }
  }, [chatId, stopChat, getChat, adopt])

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
    loaded: chatId === null || chat !== null || notFound,
    running,
    stopping,
    stopUnconfirmed,
    error: sending !== null ? null : (chat?.error ?? null),
    sendProblem,
    unsent: pending !== null && sending === null,
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
