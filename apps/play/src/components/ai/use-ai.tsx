// One AI call from the page (design "AI features", Interfaces #5): `runAiFn` on the signed-in person's own runtime.
// The hook keeps the last outcome in memory only (INV-AI, D12): nothing it shows is saved anywhere.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { runAiFn, type AiOutcome, type AiRequest, type AiValue } from '~/server/ai'

export type AiState<V extends AiValue> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; outcome: AiOutcome<V> }
  /** The request never got an answer (network failure or a server error page). */
  | { status: 'unreachable' }

/**
 * `run()` starts the call for `request` (a newer run supersedes an older one); `cancel()` aborts a call in flight and
 * returns to idle. A signed-out caller is sent to sign-in by `useServerFn` (the server function throws a redirect).
 */
export function useAi<V extends AiValue>(request: AiRequest): { state: AiState<V>; run: () => void; cancel: () => void } {
  const call = useServerFn(runAiFn)
  const [state, setState] = useState<AiState<V>>({ status: 'idle' })
  const controller = useRef<AbortController | null>(null)
  // The request is rebuilt on every render; the latest one is what a run sends.
  const latest = useRef(request)
  latest.current = request

  const cancel = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setState({ status: 'idle' })
  }, [])

  const run = useCallback(() => {
    controller.current?.abort()
    const mine = new AbortController()
    controller.current = mine
    setState({ status: 'loading' })
    call({ data: latest.current, signal: mine.signal }).then(
      (outcome) => {
        if (controller.current !== mine) return
        controller.current = null
        // A redirect to sign-in resolves to the navigation, not an outcome.
        if (!isOutcome(outcome)) return setState({ status: 'idle' })
        setState({ status: 'done', outcome: outcome as AiOutcome<V> })
      },
      () => {
        if (controller.current !== mine) return
        controller.current = null
        setState({ status: 'unreachable' })
      },
    )
  }, [call])

  useEffect(() => () => controller.current?.abort(), [])

  return { state, run, cancel }
}

const isOutcome = (v: unknown): v is AiOutcome =>
  typeof v === 'object' && v !== null && ['result', 'failed', 'refused'].includes((v as { kind?: unknown }).kind as string)
