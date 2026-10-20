// Canonical URLs are always on the production host, whatever host is serving the page (dev, preview deploys),
// so a copied or printed link is the one readers should keep.
export const SITE_ORIGIN = 'https://rules.heartrush.party'

export function canonicalUrl(path: string, anchor?: string | null) {
  return `${SITE_ORIGIN}${path}${anchor ? `#${anchor}` : ''}`
}

/** Copy text to the clipboard; false when the browser refuses (no permission, insecure context, no API). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
