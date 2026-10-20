// An in-body cross-reference. The link is a real router Link (dotted underline via `data-xref`) and always
// navigates normally. With a PreviewProvider above it:
// - on a device that can hover, pointer hover (250ms) or keyboard focus opens one bounded preview card;
// - on a coarse pointer, an adjacent 44px "Preview <term>" button opens the same content as a bottom sheet,
//   without changing the route or history.
// The preview JSON is fetched only when a preview opens. Without a provider (or inside a preview) this renders
// the plain link and never fetches.
import { Link } from '@tanstack/react-router'
import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'
import type { LinkTarget } from '@heartrush/content/types'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@heartrush/ui/components/hover-card'
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@heartrush/ui/components/sheet'
import { Button } from '@heartrush/ui/components/button'
import { usePreview } from './load-preview'
import { PreviewProvider, usePreviewContentVersion } from './preview-context'
import { FullRuleLink, PreviewBreadcrumb, PreviewExcerpt, PreviewStatus } from './preview-content'

export function ReferenceLink({ target, children }: { target: LinkTarget; children: ReactNode }) {
  const contentVersion = usePreviewContentVersion()
  // The hover card is attached only where the primary input can hover: Radix's trigger cancels touchstart, and a
  // touch reader previews through the adjacent button instead. Server and hydration render the plain link.
  const canHover = useCanHover()
  const link = (
    <Link to={target.path} hash={target.anchor ?? undefined} data-xref className={contentVersion ? 'whitespace-normal' : undefined}>
      {children}
    </Link>
  )
  if (!contentVersion) return link
  const term = textOf(children).trim() || 'reference'
  // Keep the touch button on the same line as the end of the term while the term itself still wraps: Chrome takes
  // the break rule at the link/button boundary from the link, so the nowrap wrapper also needs a word joiner there.
  return (
    <span className="whitespace-nowrap">
      {canHover ? (
        <HoverPreview contentVersion={contentVersion} target={target}>
          {link}
        </HoverPreview>
      ) : (
        link
      )}
      {'\u2060'}
      <TouchPreview contentVersion={contentVersion} target={target} term={term} />
    </span>
  )
}

function HoverPreview({ contentVersion, target, children }: { contentVersion: string; target: LinkTarget; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const state = usePreview(contentVersion, target.previewId, open)
  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent aria-label="Reference preview" className="flex flex-col gap-3 overflow-hidden">
        <PreviewProvider contentVersion={null}>
          {state.status === 'ready' ? (
            <>
              <div className="flex flex-col gap-0.5">
                <PreviewBreadcrumb preview={state.preview} />
                <p className="font-serif text-h4 font-semibold text-foreground">{state.preview.title}</p>
              </div>
              {/* Title and the full-rule link stay in view; only the excerpt scrolls inside the 320px card. */}
              <div className="-mr-2 min-h-0 overflow-y-auto pr-2">
                <PreviewExcerpt preview={state.preview} className="text-table" />
              </div>
              <FullRuleLink target={target} onClick={() => setOpen(false)} className="shrink-0" />
            </>
          ) : (
            <PreviewStatus state={state} target={target} />
          )}
        </PreviewProvider>
      </HoverCardContent>
    </HoverCard>
  )
}

function TouchPreview({ contentVersion, target, term }: { contentVersion: string; target: LinkTarget; term: string }) {
  const [open, setOpen] = useState(false)
  // Read full rule closes the sheet and navigates; returning focus to the trigger then would scroll the page back
  // to it, away from the rule just opened.
  const navigating = useRef(false)
  const state = usePreview(contentVersion, target.previewId, open)
  return (
    <Sheet open={open} onOpenChange={(next) => {
      if (next) navigating.current = false
      setOpen(next)
    }}>
      <SheetTrigger
        aria-label={`Preview ${term}`}
        className="print-hidden relative ml-1 hidden size-5 items-center justify-center rounded-sm align-[-0.2em] text-primary after:absolute after:top-1/2 after:left-0 after:size-11 after:-translate-y-1/2 pointer-coarse:inline-flex"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="lucide size-4">
          {/* Lucide "info", inlined: lucide-react is a dependency of @heartrush/ui, not of this app. */}
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </SheetTrigger>
      <SheetContent side="bottom" aria-describedby={undefined} onCloseAutoFocus={(event) => navigating.current && event.preventDefault()}>
        <PreviewProvider contentVersion={null}>
          <SheetHeader>
            {state.status === 'ready' && <PreviewBreadcrumb preview={state.preview} />}
            <SheetTitle className="font-serif text-h4">{state.status === 'ready' ? state.preview.title : term}</SheetTitle>
          </SheetHeader>
          <div className="px-4 py-4">
            {state.status === 'ready' ? (
              <PreviewExcerpt preview={state.preview} className="text-body-sm" />
            ) : (
              <PreviewStatus state={state} target={target} />
            )}
          </div>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="outline" size="lg" className="flex-1">
                Close
              </Button>
            </SheetClose>
            <Button asChild size="lg" className="flex-1">
              <Link
                to={target.path}
                hash={target.anchor ?? undefined}
                onClick={() => {
                  navigating.current = true
                  setOpen(false)
                }}
              >
                Read full rule →
              </Link>
            </Button>
          </SheetFooter>
        </PreviewProvider>
      </SheetContent>
    </Sheet>
  )
}

/** True unless the primary pointer is coarse — the exact complement of the `pointer-coarse:` variant that shows
    the touch button. False on the server and during hydration. */
function useCanHover() {
  const [canHover, setCanHover] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    setCanHover(!query.matches)
    const onChange = () => setCanHover(!query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return canHover
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return Children.toArray(node.props.children).map(textOf).join('')
  return ''
}
