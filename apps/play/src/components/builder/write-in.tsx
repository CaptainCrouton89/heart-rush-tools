// The values a card's Apply just wrote are written in with the restyle's motion (`.written.fresh` in `styles/app.css`,
// the class the sheet's `Written` uses; reduced motion turns it off there): design "Look", "the only motion is the
// restyle's write-in on a value that just changed in the builder after Apply". The build route holds which fields the
// last Apply wrote; a field is written in once and then let go, when its animation ends. A field on a step that is not
// on screen (or in the hidden Builder tab on phone) keeps waiting, and is written in when it is first shown.
import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@heartrush/ui/lib/utils'
import type { FieldKey } from './draft-rules'

export type WrittenIn = { fields: ReadonlySet<FieldKey>; done(field: FieldKey): void }

const NONE: WrittenIn = { fields: new Set(), done: () => {} }
const WrittenInContext = createContext<WrittenIn>(NONE)

export const WrittenInProvider = WrittenInContext.Provider

/** Wraps the control or text showing `field`; `className` sets its layout (it stays the same while the value is written in). */
export function WriteIn({ field, className, children }: { field: FieldKey; className?: string; children: ReactNode }) {
  const written = useContext(WrittenInContext)
  const fresh = written.fields.has(field)
  return (
    <span
      className={cn(fresh && 'written fresh', className)}
      onAnimationEnd={(e) => {
        if (fresh && e.target === e.currentTarget && e.animationName === 'settle') written.done(field)
      }}
    >
      {children}
    </span>
  )
}
