// Lucide glyphs the article uses (Link, Printer, ChevronLeft/Right/Down), inlined with Lucide's path data:
// `lucide-react` is a dependency of @heartrush/ui, not of this app. The `lucide` class picks up the design
// system's 18px / 1.75 stroke.
import type { ComponentProps } from 'react'

function Glyph({ className, children, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `lucide ${className}` : 'lucide'}
      {...props}
    >
      {children}
    </svg>
  )
}

export const LinkIcon = (p: ComponentProps<'svg'>) => (
  <Glyph {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Glyph>
)

export const PrinterIcon = (p: ComponentProps<'svg'>) => (
  <Glyph {...p}>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </Glyph>
)

export const ChevronLeftIcon = (p: ComponentProps<'svg'>) => (
  <Glyph {...p}>
    <path d="m15 18-6-6 6-6" />
  </Glyph>
)

export const ChevronRightIcon = (p: ComponentProps<'svg'>) => (
  <Glyph {...p}>
    <path d="m9 18 6-6-6-6" />
  </Glyph>
)

export const ChevronDownIcon = (p: ComponentProps<'svg'>) => (
  <Glyph {...p}>
    <path d="m6 9 6 6 6-6" />
  </Glyph>
)
