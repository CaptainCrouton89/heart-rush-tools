// Breadcrumb trail for any compiled page: `crumbs` is `page.breadcrumbs` (book first), `current` the page title.
// Below 768px the middle ancestors collapse behind a labelled disclosure, keeping the book and the immediate parent.
// Collapsed crumbs stay in the DOM, only visually hidden (and shown again while one holds keyboard focus), so keyboard
// and screen-reader users reach every ancestor without opening anything; the labelled disclosure button reveals them
// in place for sighted users.
import { Fragment, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { Crumb } from '@heartrush/content/types'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@heartrush/ui/components/breadcrumb'

export function ArticleBreadcrumbs({ crumbs, current }: { crumbs: Crumb[]; current: string }) {
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  const middle = crumbs.slice(1, -1)
  const collapsed = middle.length > 0 && !expanded
  const hideNarrow = collapsed ? 'max-md:sr-only max-md:focus-within:not-sr-only' : undefined

  return (
    <Breadcrumb className="print-hidden">
      <BreadcrumbList ref={listRef}>
        {crumbs.map((crumb, i) => {
          const isMiddle = i > 0 && i < crumbs.length - 1
          return (
            <Fragment key={crumb.path}>
              {i > 0 && <BreadcrumbSeparator className={isMiddle && collapsed ? 'max-md:hidden' : undefined} />}
              <BreadcrumbItem className={isMiddle ? hideNarrow : undefined}>
                <BreadcrumbLink asChild>
                  <Link to={crumb.path} activeOptions={{ exact: true }}>{crumb.title}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {i === 0 && collapsed && (
                <>
                  <BreadcrumbSeparator className="md:hidden" />
                  <li className="md:hidden">
                    <button
                      type="button"
                      aria-expanded={false}
                      aria-label={`Show ${middle.length} more ${middle.length === 1 ? 'level' : 'levels'}`}
                      onClick={() => {
                        setExpanded(true)
                        // The button disappears; keep focus on the first revealed ancestor.
                        requestAnimationFrame(() => listRef.current?.querySelectorAll('a')[1]?.focus())
                      }}
                      className="-my-3 inline-flex size-11 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                    >
                      <BreadcrumbEllipsis />
                    </button>
                  </li>
                </>
              )}
            </Fragment>
          )
        })}
        {crumbs.length > 0 && <BreadcrumbSeparator />}
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
