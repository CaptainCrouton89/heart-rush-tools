// Breadcrumbs for catalogue and entry pages. Below 768px the middle ancestors collapse behind a labelled
// disclosure, keeping the book and the immediate parent; the disclosure reveals them for keyboard and screen readers.
import { Fragment, useState } from 'react'
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
import { cn } from '@heartrush/ui/lib/utils'

export function Crumbs({ crumbs, current }: { crumbs: Crumb[]; current: string }) {
  const [expanded, setExpanded] = useState(false)
  const middle = crumbs.length > 2 ? crumbs.slice(1, -1) : []
  const collapsed = !expanded && middle.length > 0
  return (
    <Breadcrumb className="print-hidden">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isMiddle = i > 0 && i < crumbs.length - 1 && middle.length > 0
          return (
            <Fragment key={crumb.path}>
              {i === 1 && collapsed && (
                <>
                  <BreadcrumbItem className="md:hidden">
                    <button
                      type="button"
                      aria-expanded={false}
                      aria-label={`Show ${middle.length} more ${middle.length === 1 ? 'level' : 'levels'}: ${middle.map((m) => m.title).join(', ')}`}
                      onClick={() => setExpanded(true)}
                      className="-my-2 inline-flex size-11 items-center justify-center rounded-sm hover:bg-surface-muted hover:text-foreground md:size-6"
                    >
                      <BreadcrumbEllipsis />
                    </button>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="md:hidden" />
                </>
              )}
              <BreadcrumbItem className={cn(isMiddle && collapsed && 'max-md:hidden')}>
                <BreadcrumbLink asChild className="inline-flex min-h-11 min-w-11 items-center md:min-h-0 md:min-w-0">
                  <Link to={crumb.path}>{crumb.title}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className={cn(isMiddle && collapsed && 'max-md:hidden')} />
            </Fragment>
          )
        })}
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
