// /worlds: one named link per world (currently only Alaria) with its description. No selector.
import { Link, createFileRoute } from '@tanstack/react-router'
import { AREA_DESCRIPTIONS } from '~/components/landing/area-descriptions'
import { pageTitle } from '~/components/landing/book-page'
import { SiteShell } from '~/components/shell/site-shell'
import { getWorldsFn } from '~/server/content'

export const Route = createFileRoute('/worlds/')({
  loader: () => getWorldsFn(),
  head: () => pageTitle('Worlds'),
  component: Worlds,
})

function Worlds() {
  const worlds = Route.useLoaderData()
  return (
    <SiteShell nav={null} activePath="/worlds">
      <div className="max-w-[720px]">
        <h1 className="font-serif text-h1-sm font-semibold text-foreground md:text-h1">Worlds</h1>
        <p className="mt-4 font-serif text-body-sm text-foreground md:text-body">{AREA_DESCRIPTIONS.worlds}</p>
        <ul className="mt-10 border-t border-border">
          {worlds.map((w) => (
            <li key={w.id} className="border-b border-border">
              <Link to={w.path} className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-5">
                <span className="font-serif text-h3 font-semibold text-foreground group-hover:text-primary group-hover:underline group-hover:underline-offset-4">
                  {w.title}
                </span>
                <span aria-hidden="true" className="row-span-2 self-center text-control text-muted-foreground group-hover:text-primary">→</span>
                {w.description && <span className="text-ui text-muted-foreground">{w.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </SiteShell>
  )
}
