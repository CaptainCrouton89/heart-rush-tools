// The site frame every page renders inside: skip link, global header, left book navigation, the main column and
// the right outline column. It knows nothing about pages; the route passes what to show.
//   nav        — the book subtree from manifest.navigation (player / gm / worlds.alaria) shown in the left sidebar;
//                null = no sidebar (home, /worlds, /search, 404)
//   activePath — the current canonical pathname; the sidebar marks it and expands its ancestors
//   localNav   — Alaria articles below sidebar depth: "Up to <parent>" plus immediate siblings, shown under the topic
//                that holds the article
//   outline    — the right "On this page" column content at ≥1280px (rendered by the article unit); null = no column
//
// Width: with a sidebar, children sit in a centred 720px reading column. Without one (home, /worlds, /search, 404)
// children get the whole content width (capped at 1440px with the page padding) and set their own measure.
import { useEffect, type ReactNode } from 'react'
import type { NavNode } from '@heartrush/content/types'
import { consumeHeadingFocus } from './focus-heading'
import { SiteHeader } from './header'
import { NavTree } from './nav-tree'

export type LocalNav = { up: { title: string; path: string }; siblings: Array<{ title: string; path: string }> }

export type SiteShellProps = {
  nav: NavNode | null
  activePath: string
  localNav?: LocalNav | null
  outline?: ReactNode | null
  children: ReactNode
}

export function SiteShell({ nav, activePath, localNav = null, outline = null, children }: SiteShellProps) {
  useEffect(() => consumeHeadingFocus(activePath), [activePath])

  return (
    <>
      <a
        href="#main-content"
        className="print-hidden sr-only rounded-md bg-surface px-4 py-2 text-control font-medium text-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <SiteHeader nav={nav} activePath={activePath} localNav={localNav} />
      <div className="mx-auto flex w-full max-w-[1440px] lg:gap-8 lg:px-8">
        {nav && (
          <div className="print-hidden sticky top-16 hidden max-h-[calc(100dvh-4rem)] w-56 shrink-0 self-start overflow-y-auto overscroll-contain py-8 lg:block xl:w-62">
            <NavTree nav={nav} activePath={activePath} localNav={localNav} touch={false} label={`${nav.label} contents`} />
          </div>
        )}
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-5 py-8 outline-none max-[359px]:px-4 md:px-8 lg:px-0 lg:py-10"
        >
          {nav ? <div className="mx-auto max-w-[720px]">{children}</div> : children}
        </main>
        {outline && (
          <div className="print-hidden sticky top-16 hidden max-h-[calc(100dvh-4rem)] w-50 shrink-0 self-start overflow-y-auto py-10 xl:block">
            {outline}
          </div>
        )}
      </div>
    </>
  )
}
