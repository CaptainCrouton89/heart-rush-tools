// In-page outline logic shared by the right outline column and the "On this page" disclosure/bar below 1280px.
// The outline comes from the compiled `page.headings` (H1 excluded), never from scanning the live DOM for headings;
// the DOM is only read to learn where each compiled heading currently sits.
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { Heading } from '@heartrush/content/types'

/** The outline shows only when the page has at least this many H2/H3 headings. */
export const MIN_OUTLINE_HEADINGS = 3

/** A heading counts as passed once its top is above this line (px from the viewport top): header + bar + margin. */
const READING_LINE = 128

/** H2 and H3 only; H4–H6 stay linkable in the body but are not listed. */
export function outlineEntries(headings: Heading[]): Heading[] {
  return headings.filter((h) => h.depth === 2 || h.depth === 3)
}

export function hasOutline(headings: Heading[]): boolean {
  return outlineEntries(headings).length >= MIN_OUTLINE_HEADINGS
}

/** Every heading id → the id of its nearest ancestor at or above `maxDepth` (itself when shallow enough). */
function ancestorsAt(headings: Heading[], maxDepth: number): Map<string, string> {
  const byId = new Map(headings.map((h) => [h.id, h]))
  const out = new Map<string, string>()
  for (const h of headings) {
    let cur: Heading | undefined = h
    while (cur && cur.depth > maxDepth) cur = cur.parentId ? byId.get(cur.parentId) : undefined
    if (cur) out.set(h.id, cur.id)
  }
  return out
}

/**
 * Scroll-spy: the id of the outline entry (H2/H3) for the most recent heading above the reading line. A deeper
 * heading resolves to its H3/H2 ancestor. Null before the first heading and during server rendering.
 */
export function useActiveHeading(headings: Heading[]): string | null {
  const toOutline = useMemo(() => ancestorsAt(headings, 3), [headings])
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return
    let frame = 0
    const update = () => {
      frame = 0
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      const line = atBottom ? window.innerHeight : READING_LINE
      let current: HTMLElement | null = null
      for (const el of elements) {
        if (el.getBoundingClientRect().top > line) break
        current = el
      }
      setActive(current ? (toOutline.get(current.id) ?? null) : null)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [headings, toOutline])

  return active
}

/** The H2 that holds an outline entry (itself when it is an H2), for the compact bar's "current section" label. */
export function useSectionOf(headings: Heading[]) {
  const toSection = useMemo(() => ancestorsAt(headings, 2), [headings])
  return (id: string | null) => (id ? (headings.find((h) => h.id === toSection.get(id)) ?? null) : null)
}

/** Move focus to a heading without scrolling (the browser or router has already scrolled it into view). */
export function focusHeading(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}

/**
 * Intentional hash navigation moves focus to the target heading: a direct load of a URL with a hash, and every
 * router navigation that changes the page or the hash (outline links, cross-references, search results).
 * Passive scrolling never moves focus.
 */
export function useHashFocus() {
  const router = useRouter()
  useEffect(() => {
    const initial = decodeURIComponent(window.location.hash.slice(1))
    if (initial) focusHeading(initial)
    return router.subscribe('onResolved', (event) => {
      const hash = event.toLocation.hash
      if (hash && (event.hashChanged || event.pathChanged)) focusHeading(hash)
    })
  }, [router])
}
