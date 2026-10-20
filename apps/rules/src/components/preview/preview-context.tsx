// Supplies the content version that preview URLs are built from (/_content/<contentVersion>/previews/<id>.json).
// The article unit wraps each rendered body once in <PreviewProvider contentVersion={page.contentVersion}>.
// Without a provider — or inside an open preview, which resets it to null — ReferenceLink is a plain link and
// never fetches, so previews never nest.
import { createContext, useContext, type ReactNode } from 'react'

const PreviewContext = createContext<string | null>(null)

export function PreviewProvider({ contentVersion, children }: { contentVersion: string | null; children: ReactNode }) {
  return <PreviewContext.Provider value={contentVersion}>{children}</PreviewContext.Provider>
}

export function usePreviewContentVersion(): string | null {
  return useContext(PreviewContext)
}
