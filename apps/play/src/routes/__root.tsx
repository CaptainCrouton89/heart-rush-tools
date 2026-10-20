/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { appearanceScript } from '@heartrush/ui/appearance'
import appCss from '~/styles/app.css?url'
import { createServerFn } from '@tanstack/react-start'
import { SiteHeader } from '~/components/site-header'

/**
 * The signed-in person, or null. `~/server/session` imports server-only modules, so client code reaches it only through a
 * server function that imports it on the server (the pattern `~/server/characters` uses).
 */
const rootSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  // A plain function: a server function called from inside another one is not in the built server-function manifest.
  const { currentSession } = await import('~/server/session')
  return currentSession()
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Heart Rush Play' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  // The session is read once per navigation here; pages that need it read it with `Route.useRouteContext()` from the root.
  beforeLoad: async () => ({ session: await rootSessionFn() }),
  component: RootLayout,
  shellComponent: RootDocument,
})

function RootLayout() {
  const { session } = Route.useRouteContext()
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-4 py-2 text-ui text-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteHeader session={session} />
      <main id="main" tabIndex={-1} className="flex-1 pb-16 outline-none">
        <Outlet />
      </main>
    </div>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
