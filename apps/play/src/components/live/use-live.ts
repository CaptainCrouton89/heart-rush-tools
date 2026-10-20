import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { LiveEvent, LiveRoll } from '~/server/live'

const FIRST_DELAY_MS = 1000
const MAX_DELAY_MS = 30_000

/**
 * Keeps one WebSocket open to the campaign's live channel while the page is mounted. Each event refetches the page's
 * loaders (`router.invalidate()`), and a roll is also passed to `onRoll`. A dropped connection reconnects after 1 s,
 * doubling to 30 s, and refetches once it is back. `null` (a character in no campaign) does nothing.
 * `status` is 'reconnecting' from the moment the connection drops until it is open again.
 */
export function useCampaignLive(campaignId: string | null, onRoll?: (roll: LiveRoll) => void): { status: 'live' | 'reconnecting' } {
  const router = useRouter()
  const [status, setStatus] = useState<'live' | 'reconnecting'>('live')
  const rollHandler = useRef(onRoll)
  rollHandler.current = onRoll

  useEffect(() => {
    if (campaignId === null) return
    let socket: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let delay = FIRST_DELAY_MS
    let stopped = false
    let dropped = false // true after a connection was lost, until the next one opens

    const connect = () => {
      const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${scheme}//${location.host}/campaigns/${encodeURIComponent(campaignId)}/live`)
      socket = ws
      ws.onopen = () => {
        delay = FIRST_DELAY_MS
        setStatus('live')
        if (dropped) {
          dropped = false
          void router.invalidate() // anything published while we were away
        }
      }
      ws.onmessage = (message) => {
        let event: LiveEvent
        try {
          event = JSON.parse(String(message.data)) as LiveEvent
        } catch {
          return
        }
        if (event.type === 'roll') rollHandler.current?.(event.roll)
        void router.invalidate()
      }
      ws.onclose = () => {
        if (stopped || socket !== ws) return
        dropped = true
        setStatus('reconnecting')
        timer = setTimeout(connect, delay)
        delay = Math.min(delay * 2, MAX_DELAY_MS)
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      socket?.close()
    }
  }, [campaignId, router])

  return { status }
}
