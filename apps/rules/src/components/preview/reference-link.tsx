// Placeholder until the preview unit lands. Contract: an in-body cross-reference link. Navigates like a normal
// router link; on desktop hover (250ms) / focus it opens one bounded preview of `target`; on touch an adjacent
// 44px "Preview <term>" button opens the same content as a bottom sheet.
import { Link } from '@tanstack/react-router'
import type { LinkTarget } from '@heartrush/content/types'
import type { ReactNode } from 'react'

export function ReferenceLink({ target, children }: { target: LinkTarget; children: ReactNode }) {
  return (
    <Link to={target.path} hash={target.anchor ?? undefined} data-xref>
      {children}
    </Link>
  )
}
