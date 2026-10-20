/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRoute, Outlet } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '~/styles/app.css?url'
import { getSessionFn } from '~/server/session'
import { SiteHeader } from '~/components/site-header'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Heart Rush Tools' },
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
    <>
      <SiteHeader session={session} />
      <Outlet />
    </>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
