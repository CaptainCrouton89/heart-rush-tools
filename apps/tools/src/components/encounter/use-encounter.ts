import { useCallback, useEffect, useRef, useState } from 'react'
import type { StoredMessage } from '~/encounter/schema'
import { api, ApiError, postMessage, type EncounterDetail } from './api'

/**
 * Encounters just created on the index page, whose stored first message this page should run once it loads. The message itself
 * is saved with the encounter; if this page is reloaded before the run starts, the message shows unanswered with "Send again".
 */
const startOnLoad = new Set<string>()
export const runFirstMessageOnLoad = (id: string) => startOnLoad.add(id)

const POLL_MS = 4000

export type RunError = { message: string; signIn?: boolean }
export type Status =
  | { kind: 'loading' }
  | { kind: 'missing' } // 404: not this GM's encounter
  | { kind: 'signedOut' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready' }

/**
 * The state of one encounter page: the stored encounter, the run in flight (one started here, or one left running by a
 * closed tab, which is polled until the server adopts its result), and the send/stop actions.
 */
export function useEncounter(id: string) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [detail, setDetail] = useState<EncounterDetail | null>(null)
  /** A send in flight from this page: the text, and when it was sent. */
  const [sending, setSending] = useState<{ text: string; since: number } | null>(null)
  const [runError, setRunError] = useState<RunError | null>(null)
  const [stopped, setStopped] = useState(false)
  const [stopping, setStopping] = useState(false)
  /** Bumped each time a new document arrives, so the page can flag the Encounter tab. */
  const [documentVersion, setDocumentVersion] = useState(0)
  const live = useRef(true)
  const lastDocument = useRef<string | undefined>(undefined)
  /** GETs are numbered as they start; a response older than one already shown (or than a streamed turn) is dropped. */
  const issued = useRef(0)
  const shown = useRef(0)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    const seq = ++issued.current
    try {
      const next = await api.get(id)
      if (!live.current || seq <= shown.current) return next
      shown.current = seq
      const doc = JSON.stringify(next.document)
      // A document that differs from the one already shown is an update; the first load is not.
      if (lastDocument.current !== undefined && next.document && doc !== lastDocument.current) setDocumentVersion((v) => v + 1)
      lastDocument.current = doc
      setDetail(next)
      setStatus({ kind: 'ready' })
      return next
    } catch (e) {
      if (!live.current || seq <= shown.current) return null
      shown.current = seq
      if (e instanceof ApiError && e.status === 404) setStatus({ kind: 'missing' })
      else if (e instanceof ApiError && e.signIn) setStatus({ kind: 'signedOut' })
      else setStatus({ kind: 'failed', message: e instanceof Error ? e.message : 'Could not load the encounter' })
      return null
    }
  }, [id])

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text) return
      setRunError(null)
      setStopped(false)
      setSending({ text, since: Date.now() })
      try {
        for await (const event of postMessage(id, text)) {
          if (event.type === 'started') {
            void refresh() // the server has stored the GM message and, on a first message, the title
          } else if (event.type === 'turn') {
            const message = event.message
            shown.current = issued.current // a GET started before the turn arrived would show the run as still going
            setDetail((d) => d && { ...d, messages: [...withGm(d.messages, text), message], running: false })
            if (message.step.kind === 'encounter') await refresh()
          } else if (event.type === 'error') {
            // Some failures leave the run going ("press Stop to try again"): the refresh below keeps it shown as running.
            if (event.stopped) setStopped(true)
            else setRunError({ message: event.message, signIn: event.signIn })
          }
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          // Another tab or a run left from before is still going: show and poll it.
          await refresh()
        } else {
          setRunError({
            message: e instanceof Error ? e.message : 'The message could not be sent',
            signIn: e instanceof ApiError && e.signIn,
          })
        }
      } finally {
        setSending(null)
        // Picks up the stored GM message (kept on stop or failure) and the title.
        void refresh()
      }
    },
    [id, refresh],
  )

  /** Stop answers once the cancel is confirmed, which can take a while when the run is still starting. */
  const stop = useCallback(async () => {
    setStopping(true)
    setRunError(null)
    try {
      const result = await api.stop(id)
      if (result.ok) setStopped(true)
      // 202: Stop is recorded but the run was still starting; polling shows it running until it ends.
    } catch (e) {
      // 502: not confirmed, the run may still be going. Stop stays available.
      setRunError({ message: e instanceof Error ? e.message : 'Could not stop the run' })
      setStopping(false)
    }
    void refresh()
  }, [id, refresh])

  // First load, then the run for the first message of an encounter the index page just created.
  useEffect(() => {
    void refresh().then((loaded) => {
      if (!startOnLoad.delete(id) || !loaded) return
      const first = loaded.messages.at(-1)
      if (loaded.messages.length === 1 && first?.role === 'gm' && !loaded.running) void send(first.text)
    })
  }, [id, refresh, send])

  // A run this page did not start (closed tab, Worker restart): poll until the server adopts its result.
  const polling = !sending && detail?.running === true
  useEffect(() => {
    if (!polling) return
    const t = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(t)
  }, [polling, refresh])

  const running = sending !== null || polling
  useEffect(() => {
    if (!running) setStopping(false)
  }, [running])
  const lastGm = [...(detail?.messages ?? [])].reverse().find((m) => m.role === 'gm')
  const runSince = sending?.since ?? (polling && lastGm ? Date.parse(lastGm.at) : null)

  // The message being sent shows at once, before the server has stored it.
  const messages = detail ? (sending ? withGm(detail.messages, sending.text) : detail.messages) : []

  return { status, detail, messages, running, runSince, runError, stopped, stopping, documentVersion, send, stop }
}

/** The messages with the GM's just-sent text appended, unless the server already stored it (resend de-dupe). */
function withGm(messages: StoredMessage[], text: string): StoredMessage[] {
  const last = messages.at(-1)
  if (last?.role === 'gm' && last.text === text) return messages
  return [...messages, { role: 'gm', text, at: new Date().toISOString() }]
}

/** The elapsed whole seconds since `since`, ticking once a second while it is set. */
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
