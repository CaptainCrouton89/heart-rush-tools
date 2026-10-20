import { useCallback, useSyncExternalStore } from 'react'

/**
 * Appearance preference: System (default), Light or Dark. Stored in this origin's localStorage,
 * so each site keeps its own. Applied as the `dark` class on <html>.
 */
export type Appearance = 'system' | 'light' | 'dark'

export const APPEARANCE_STORAGE_KEY = 'heartrush-appearance'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Inline script for <head>, placed before the stylesheet renders so the right theme is applied
 * before first paint. If storage is unreadable it follows the system preference.
 * Use: <script dangerouslySetInnerHTML={{ __html: appearanceScript }} /> and give <html>
 * `suppressHydrationWarning`, since the class differs from the server render.
 */
export const appearanceScript = `(function(){var p=null;try{p=localStorage.getItem(${JSON.stringify(
  APPEARANCE_STORAGE_KEY,
)})}catch(e){}var d=p==='dark'||(p!=='light'&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);document.documentElement.classList.toggle('dark',d)})()`

function parse(value: string | null): Appearance {
  return value === 'light' || value === 'dark' ? value : 'system'
}

function read(): Appearance {
  try {
    return parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function systemIsDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

function apply(appearance: Appearance) {
  const dark = appearance === 'dark' || (appearance === 'system' && systemIsDark())
  document.documentElement.classList.toggle('dark', dark)
}

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage)
    window.matchMedia(DARK_QUERY).addEventListener('change', onSystemChange)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage)
      window.matchMedia(DARK_QUERY).removeEventListener('change', onSystemChange)
    }
  }
}

function onStorage(event: StorageEvent) {
  if (event.key !== APPEARANCE_STORAGE_KEY) return
  apply(read())
  notify()
}

function onSystemChange() {
  apply(read())
  notify()
}

/** Writes the preference, applies it to <html>, and updates every `useAppearance` reader. */
export function setAppearance(appearance: Appearance) {
  try {
    if (appearance === 'system') window.localStorage.removeItem(APPEARANCE_STORAGE_KEY)
    else window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance)
  } catch {
    // Storage unavailable: the choice applies to this page view only.
  }
  apply(appearance)
  notify()
}

function getResolved(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * Current preference and the theme actually showing. During SSR and hydration it reports
 * `system`/`light`, then the stored value; render the appearance menu's selection from it.
 */
export function useAppearance() {
  const appearance = useSyncExternalStore(subscribe, read, () => 'system' as const)
  const resolved = useSyncExternalStore(subscribe, getResolved, () => 'light' as const)
  const set = useCallback((next: Appearance) => setAppearance(next), [])
  return { appearance, resolved, setAppearance: set }
}
