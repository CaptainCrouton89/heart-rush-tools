/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { appearanceScript } from '@heartrush/ui/appearance'
import appCss from '~/styles/app.css?url'
import { NotFound } from '~/components/not-found'
import { SearchPalette } from '~/components/search/palette'
import { openSearch } from '~/lib/search-store'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Heart Rush Rules' },
      { name: 'description', content: 'The Heart Rush rulebook, GM guide and Alaria wiki.' },
      // Link previews: the shared Heart Rush card served by the heartrush.party Worker (apps/hub).
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Heart Rush' },
      { property: 'og:title', content: 'Heart Rush Rules' },
      { property: 'og:description', content: 'The Heart Rush rulebook, GM guide and Alaria wiki.' },
      { property: 'og:image', content: 'https://heartrush.party/og.jpg' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

/** ⌘K / Ctrl K opens search. Never bare "/" or single letters; not during IME composition; not over another dialog. */
function useSearchShortcut() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing || event.keyCode === 229) return
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      event.preventDefault()
      openSearch()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

function RootDocument({ children }: { children: ReactNode }) {
  useSearchShortcut()
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <SearchPalette />
        <Scripts />
      </body>
    </html>
  )
}
