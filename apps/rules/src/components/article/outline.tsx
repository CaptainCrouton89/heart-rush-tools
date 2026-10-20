// "On this page": the compiled H2/H3 outline with scroll-spy. Two presentations of the same list:
//   ArticleOutline — the right column at ≥1280px (passed to SiteShell's `outline`; pass it only when hasOutline()).
//   MobileOutline  — below 1280px, a disclosure under the title/actions, and once the reader scrolls past it a 44px
//                    sticky bar under the header showing the current H2 and opening the same list in a sheet.
// Both render nothing when the page has fewer than three H2/H3 headings. Anchor jumps are instant (never animated).
// Focus moving to the target heading after hash navigation is ArticleBody's job (useHashFocus).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { Heading } from '@heartrush/content/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@heartrush/ui/components/sheet'
import { cn } from '@heartrush/ui/lib/utils'
import { focusHeading, hasOutline, outlineEntries, useActiveHeading, useSectionOf } from '~/lib/outline'
import { ChevronDownIcon } from './icons'

function OutlineList({
  headings,
  active,
  onSelect,
  touch,
}: {
  headings: Heading[]
  active: string | null
  onSelect?: () => void
  touch: boolean
}) {
  const navigate = useNavigate()
  return (
    <ul className="flex flex-col">
      {outlineEntries(headings).map((h) => {
        const current = h.id === active
        return (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              aria-current={current ? 'location' : undefined}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                onSelect?.()
                // Through the router so its history stays consistent; the default hash scroll is instant.
                void navigate({ to: '.', hash: h.id }).then(() => focusHeading(h.id))
              }}
              className={cn(
                'block border-l-2 py-1 text-ui transition-colors hover:text-foreground',
                touch && 'flex min-h-11 items-center py-2',
                h.depth === 3 ? 'pl-6' : 'pl-3',
                current ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground',
              )}
            >
              {h.text}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/** The right-column outline at ≥1280px. */
export function ArticleOutline({ headings }: { headings: Heading[] }) {
  const active = useActiveHeading(headings)
  if (!hasOutline(headings)) return null
  return (
    <nav aria-label="On this page">
      <p className="eyebrow mb-3">On this page</p>
      <OutlineList headings={headings} active={active} touch={false} />
    </nav>
  )
}

/**
 * Below 1280px: the "On this page" disclosure (render it right after the article actions, inside the same container
 * as the body so the sticky bar stays within the article) and the 44px sticky bar that appears once the disclosure
 * has scrolled out of view.
 */
export function MobileOutline({ headings }: { headings: Heading[] }) {
  const active = useActiveHeading(headings)
  const sectionOf = useSectionOf(headings)
  const [open, setOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pastDisclosure, setPastDisclosure] = useState(false)
  const disclosureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = disclosureRef.current
    if (!el) return
    const update = () => setPastDisclosure(el.getBoundingClientRect().bottom < headerHeight())
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  if (!hasOutline(headings)) return null
  const section = sectionOf(active)

  return (
    <>
      <div
        className={cn(
          'print-hidden sticky top-14 z-30 -mx-5 h-0 max-[359px]:-mx-4 md:-mx-8 lg:top-16 lg:mx-0 xl:hidden',
          !pastDisclosure && 'invisible',
        )}
        aria-hidden={!pastDisclosure}
      >
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <button
            type="button"
            tabIndex={pastDisclosure ? 0 : -1}
            onClick={() => setSheetOpen(true)}
            className="flex h-11 w-full items-center gap-2 border-b border-border bg-surface px-5 text-left text-ui max-[359px]:px-4 md:px-8 lg:px-4"
          >
            <span className="shrink-0 font-medium text-foreground">On this page</span>
            {section && (
              <>
                <span aria-hidden="true" className="text-muted-foreground">·</span>
                <span className="min-w-0 truncate text-muted-foreground">{section.text}</span>
              </>
            )}
            <ChevronDownIcon className="ml-auto" />
          </button>
          <SheetContent side="bottom" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>On this page</SheetTitle>
            </SheetHeader>
            <nav aria-label="On this page" className="px-2 py-2">
              <OutlineList headings={headings} active={active} touch onSelect={() => setSheetOpen(false)} />
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <div ref={disclosureRef} className="print-hidden mt-6 border-y border-border xl:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-outline-list"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full items-center gap-2 py-2 text-left text-ui font-medium text-foreground"
        >
          On this page
          <ChevronDownIcon className={cn('ml-auto transition-transform', open && 'rotate-180')} />
        </button>
        <nav id="mobile-outline-list" aria-label="On this page" hidden={!open} className="pb-3">
          <OutlineList headings={headings} active={active} touch onSelect={() => setOpen(false)} />
        </nav>
      </div>
    </>
  )
}

/** Height of the sticky global header (56px below 1024px, 64px from 1024px). */
function headerHeight() {
  return window.matchMedia('(min-width: 1024px)').matches ? 64 : 56
}
