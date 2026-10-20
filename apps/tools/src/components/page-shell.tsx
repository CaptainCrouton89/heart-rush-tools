import type { ReactNode } from 'react'

/**
 * The frame every tools page sits in: content width, page padding and the title block.
 * The title block is left off paper so a printout holds only the page's output.
 */
export function PageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-10 max-[359px]:px-4 md:px-8 md:pt-14">
      <header className="print-hidden mb-10 max-w-[720px]">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-serif text-h1-sm font-semibold text-balance md:text-h1">{title}</h1>
        {description && (
          <p className="mt-3 font-serif text-body-sm text-muted-foreground md:text-body">{description}</p>
        )}
      </header>
      {children}
    </div>
  )
}
