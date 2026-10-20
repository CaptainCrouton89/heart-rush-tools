/** Spec §4: while the campaign's live connection is down the page says so; it disappears once the connection is back. */
export function LiveStatus({ status }: { status: 'live' | 'reconnecting' }) {
  return (
    <p role="status" aria-live="polite" className={status === 'reconnecting' ? 'border-b border-border bg-surface-muted px-5 py-2 text-center text-ui font-medium text-warning md:px-8' : 'sr-only'}>
      {status === 'reconnecting' ? 'Live updates paused — reconnecting' : ''}
    </p>
  )
}
