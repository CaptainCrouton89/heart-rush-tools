// Header destinations shared by the desktop header and the phone Menu sheet.
import type { ReactNode } from 'react'

export const BOOKS: Array<{ path: string; label: string }> = [
  { path: '/player', label: 'Player rules' },
  { path: '/gm', label: 'GM guide' },
  { path: '/worlds', label: 'Worlds' },
]

export const SITES = [
  { href: 'https://tools.heartrush.party/', label: 'Tools' },
  { href: 'https://play.heartrush.party/', label: 'Play' },
] as const

export function inBook(bookPath: string, activePath: string) {
  return activePath === bookPath || activePath.startsWith(`${bookPath}/`)
}

/** Another Heart Rush site: same tab by default, ↗ marker announced as "external site". */
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} className={className}>
      {children}
      <span aria-hidden="true">&nbsp;↗</span>
      <span className="sr-only"> (external site)</span>
    </a>
  )
}
