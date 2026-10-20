import type { ReactNode } from 'react'
import { createFileRoute, Link, type LinkProps } from '@tanstack/react-router'
import { PageShell } from '~/components/page-shell'

export const Route = createFileRoute('/')({ component: Home })

type Tool = {
  to: LinkProps['to']
  title: string
  description: string
  /** Runs on the person's own Northlight account, so it needs sign-in. */
  needsSignIn: boolean
}

/** Every tool on this site. Adding a tool is one entry here plus its route. */
const TOOLS: Tool[] = [
  {
    to: '/encounter-builder',
    title: 'Encounter builder',
    description:
      'Describe a fight in chat and get a finished encounter: stat blocks with counts, terrain, hooks and scaling notes, sized to your party.',
    needsSignIn: true,
  },
  {
    to: '/monster-generator',
    title: 'Monster generator',
    description:
      'Describe a creature and get a Heart Rush stat block, from a single minion to a multi-part boss.',
    needsSignIn: true,
  },
]

const SIBLING_SITES = [
  { href: 'https://rules.heartrush.party/', title: 'Rules', description: 'The rulebook, GM guide and the Alaria wiki.' },
  { href: 'https://play.heartrush.party/', title: 'Play', description: 'Character sheets and parties.' },
] as const

function Row({ title, description, meta }: { title: ReactNode; description: string; meta?: string }) {
  return (
    <>
      <span className="flex items-baseline justify-between gap-4">
        <span className="font-serif text-h4 font-semibold text-foreground group-hover:text-primary">{title}</span>
        <span aria-hidden="true" className="text-control text-muted-foreground group-hover:text-primary">
          →
        </span>
      </span>
      <span className="mt-1 block font-serif text-body-sm text-muted-foreground">{description}</span>
      {meta && <span className="mt-2 block text-meta text-muted-foreground">{meta}</span>}
    </>
  )
}

const rowLink = 'group block rounded-sm py-5 outline-offset-4'

function Home() {
  return (
    <PageShell title="Heart Rush Tools" description="Tools for running and playing Heart Rush.">
      <section aria-labelledby="tools-heading" className="max-w-[720px]">
        <h2 id="tools-heading" className="eyebrow">
          Tools
        </h2>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {TOOLS.map((tool) => (
            <li key={tool.title}>
              <Link to={tool.to} className={rowLink}>
                <Row
                  title={tool.title}
                  description={tool.description}
                  meta={tool.needsSignIn ? 'Runs on your Northlight account; needs sign-in' : undefined}
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="elsewhere-heading" className="mt-14 max-w-[720px]">
        <h2 id="elsewhere-heading" className="eyebrow">
          Elsewhere in Heart Rush
        </h2>
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {SIBLING_SITES.map((site) => (
            <li key={site.href}>
              <a href={site.href} className={rowLink}>
                <Row
                  title={
                    <>
                      {site.title}
                      <span className="sr-only"> (external site)</span>
                    </>
                  }
                  description={site.description}
                  meta={new URL(site.href).host}
                />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  )
}
