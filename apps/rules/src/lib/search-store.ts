// Open/close state for the global search palette, shared by the header button, the ⌘K shortcut and the palette itself.
import { useSyncExternalStore } from 'react'

let open = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function openSearch() { open = true; emit() }
export function closeSearch() { open = false; emit() }
export function useSearchOpen(): boolean {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => open, () => false)
}
