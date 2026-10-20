// Placeholder until the shell unit lands. Contract (do not change the props without telling the orchestrator):
//   nav       — the book subtree from manifest.navigation (player / gm / worlds.alaria) shown in the left sidebar; null = no sidebar (home, /worlds, /search, 404)
//   activePath — the current canonical pathname; the sidebar marks it and expands its ancestors
//   localNav  — Alaria articles below sidebar depth: "Up to <parent>" plus immediate siblings, replacing the topic's expanded area
//   outline   — the right "On this page" column content at ≥1280px (rendered by the article unit); null = no column
import type { ReactNode } from 'react'
import type { NavNode } from '@heartrush/content/types'

export type LocalNav = { up: { title: string; path: string }; siblings: Array<{ title: string; path: string }> }

export type SiteShellProps = {
  nav: NavNode | null
  activePath: string
  localNav?: LocalNav | null
  outline?: ReactNode | null
  children: ReactNode
}

export function SiteShell({ children }: SiteShellProps) {
  return <main>{children}</main>
}
