// Lucide glyphs the shell uses (Search, Menu, X, ChevronDown), inlined with Lucide's path data: `lucide-react` is a
// dependency of @heartrush/ui, not of this app. The `lucide` class picks up the design system's 18px / 1.75 stroke.
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

export const SearchIcon = (p: ComponentProps<'svg'>) => (
  <Glyph {...p}>
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </Glyph>
)

export const MenuIcon = (p: ComponentProps<'svg'>) => (
  <Glyph {...p}>
    <path d="M4 5h16" />
    <path d="M4 12h16" />
    <path d="M4 19h16" />
  </Glyph>
)

export const XIcon = (p: ComponentProps<'svg'>) => (
  <Glyph {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Glyph>
)

export const ChevronDownIcon = (p: ComponentProps<'svg'>) => (
  <Glyph {...p}>
    <path d="m6 9 6 6 6-6" />
  </Glyph>
)
