/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRoute, Outlet } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { appearanceScript } from '@heartrush/ui/appearance'
import appCss from '~/styles/app.css?url'
import { getSessionFn } from '~/server/session'
import { SiteHeader } from '~/components/site-header'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Heart Rush Tools' },
      { name: 'description', content: 'Tools for running and playing Heart Rush.' },
      // Link previews: the shared Heart Rush card served by the heartrush.party Worker (apps/hub).
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Heart Rush' },
      { property: 'og:title', content: 'Heart Rush Tools' },
      { property: 'og:description', content: 'Tools for running and playing Heart Rush.' },
      { property: 'og:image', content: 'https://heartrush.party/og.jpg' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  loader: () => getSessionFn(),
  component: RootLayout,
  shellComponent: RootDocument,
})

function RootLayout() {
  const session = Route.useLoaderData()
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
