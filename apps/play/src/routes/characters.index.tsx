import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'
import { listCharactersFn, type CharacterSummary } from '~/server/characters'

export const Route = createFileRoute('/characters/')({
  // listCharactersFn calls requireUser: signed out, a page load redirects to /auth/login?returnTo=/characters.
  loader: () => listCharactersFn(),
  head: () => ({ meta: [{ title: 'Characters · Heart Rush Play' }] }),
  component: CharacterList,
})

function CharacterList() {
  const { characters } = Route.useLoaderData()
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-8 md:px-8 md:pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-h1-sm font-semibold md:text-h1">Characters</h1>
        <Button asChild size="lg">
          <Link to="/characters/new">New character</Link>
        </Button>
      </div>
      {characters.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">You have no characters yet. Make one with New character.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {characters.map((c) => (
            <li key={c.id}>
              <CharacterCard character={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * One card. A finished character links to its sheet, a draft to the builder ("Continue"). Both target routes are built by
 * other units, so these are plain links rather than typed router links.
 */
function CharacterCard({ character: c }: { character: CharacterSummary }) {
  const href = c.draft ? `/characters/${c.id}/build` : `/characters/${c.id}`
  return (
    <a
      href={href}
      className="flex min-h-11 flex-col gap-2 rounded-md border border-border bg-surface p-4 text-foreground transition-colors hover:border-muted-foreground hover:bg-surface-muted"
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate font-serif text-h4 font-semibold">{c.name || 'Unnamed character'}</span>
        {c.draft ? (
          <span className="shrink-0 text-ui font-medium text-primary">Continue</span>
        ) : (
          c.hp && (
            <span className="shrink-0 font-sans text-control font-semibold tabular-nums" aria-label={`HP ${c.hp.current} of ${c.hp.effectiveMax}`}>
              {c.hp.current}/{c.hp.effectiveMax} <span className="text-meta font-normal text-muted-foreground">HP</span>
            </span>
          )
        )}
      </span>
      <span className="flex flex-wrap gap-x-3 gap-y-1 text-ui text-muted-foreground">
        <span>{c.draft ? 'Draft' : c.raceTitle}</span>
        {c.campaignName && (
          <>
            <span aria-hidden="true">·</span>
            <span>{c.campaignName}</span>
          </>
        )}
      </span>
    </a>
  )
}
