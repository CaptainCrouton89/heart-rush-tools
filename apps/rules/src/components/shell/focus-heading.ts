// After a destination is chosen in the phone Menu sheet, focus moves to the new page's H1.
// The request outlives the sheet: navigating to a different route remounts the SiteShell that owns the sheet,
// so it is held here and consumed by whichever SiteShell renders the destination.
let pendingPath: string | null = null

export function requestHeadingFocus(path: string) {
  pendingPath = path
}

/** Focus the page H1 if a request is waiting for `activePath` (the path the calling shell has rendered). */
export function consumeHeadingFocus(activePath: string) {
  if (pendingPath !== activePath) return
  pendingPath = null
  setTimeout(() => {
    const h1 = document.querySelector<HTMLElement>('#main-content h1')
    if (!h1) return
    if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1')
    h1.focus({ preventScroll: true })
  }, 0)
}
