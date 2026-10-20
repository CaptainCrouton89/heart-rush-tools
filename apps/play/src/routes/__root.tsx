/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
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

/**
 * The press bloom (play design, Motion): on pointer down a button gets `data-pressed` and the touch point as `--px` /
 * `--py`, which the stylesheet turns into a faint ember bloom from that point; it is removed on release.
 */
function usePressBloom() {
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-slot="button"]') : null
      if (!b || b.matches(':disabled')) return
      const r = b.getBoundingClientRect()
      b.style.setProperty('--px', `${((e.clientX - r.left) / r.width) * 100}%`)
      b.style.setProperty('--py', `${((e.clientY - r.top) / r.height) * 100}%`)
      b.setAttribute('data-pressed', '')
      const up = () => (b.removeAttribute('data-pressed'), window.removeEventListener('pointerup', up), window.removeEventListener('pointercancel', up))
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [])
}

function RootLayout() {
  const { session } = Route.useRouteContext()
  usePressBloom()
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
        {/* A slight irregular edge for rings, strike lines and marks, so they look drawn with a pen (`filter: url(#inkedge)`). */}
        <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
          <filter id="inkedge" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={4} result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale={1.3} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
