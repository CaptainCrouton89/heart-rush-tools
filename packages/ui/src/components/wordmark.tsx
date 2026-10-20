import * as React from 'react'
import { cn } from '../lib/utils'

/**
 * HEART RUSH typographic wordmark: serif semibold 19px, 0.06em tracking, a small solid red
 * diamond before the words. The diamond is decorative; the accessible name is "Heart Rush".
 * Wrap it in the app's home Link; it renders a span, not a link.
 */
function Wordmark({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="wordmark"
      className={cn(
        'inline-flex items-center gap-2 font-serif text-wordmark font-semibold tracking-[0.06em] whitespace-nowrap text-foreground uppercase',
        className,
      )}
      {...props}
    >
      <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true" focusable="false" className="shrink-0 text-primary">
        <path d="M5 0 10 5 5 10 0 5Z" fill="currentColor" />
      </svg>
      <span>Heart Rush</span>
    </span>
  )
}

export { Wordmark }
