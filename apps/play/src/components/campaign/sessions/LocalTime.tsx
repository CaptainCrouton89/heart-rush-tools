import { useSyncExternalStore } from 'react'

// Times on the campaign page are read on the server for the first render, where the time zone and locale are the Worker's
// rather than the viewer's. Rendering the local text only after hydration keeps the server and client markup the same.
const subscribe = () => () => {}
const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )

/** A moment (ISO timestamp) in the viewer's locale and time zone: "Oct 20, 3:14 PM". */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const hydrated = useHydrated()
  return (
    <time dateTime={iso} className={className}>
      {hydrated ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
    </time>
  )
}

/** A calendar date (`YYYY-MM-DD`, no time zone) in the viewer's locale: "Oct 20, 2026". */
export function LocalDate({ date, className }: { date: string; className?: string }) {
  const hydrated = useHydrated()
  return (
    <time dateTime={date} className={className}>
      {hydrated ? new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : date}
    </time>
  )
}
