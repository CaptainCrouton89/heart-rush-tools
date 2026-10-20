// The builder for a draft (plan row B1a; ruling 8). `/characters/new` creates the draft after step 1; this route edits
// it until Finish. The current step is in the URL (`?step=`), so reload and Back keep the player's place.
import { createFileRoute, notFound, redirect, useNavigate } from '@tanstack/react-router'
import { BuilderShell } from '~/components/builder/BuilderShell'
import { reachableStep, toStep, useDraft, type StepNumber } from '~/components/builder/use-draft'
import { getCharacterFn, type CharacterDoc } from '~/server/characters'

export const Route = createFileRoute('/characters/$id_/build')({
  validateSearch: (search: Record<string, unknown>): { step?: number } => (search.step === undefined ? {} : { step: toStep(search.step) }),
  // getCharacterFn calls requireUser: signed out, a page load redirects to sign-in and back here.
  loader: async ({ params }): Promise<CharacterDoc> => {
    const result = await getCharacterFn({ data: { characterId: params.id } })
    if (!result.ok) throw notFound()
    if (!result.character.state.draft) throw redirect({ to: '/characters/$id', params: { id: params.id } })
    // Only the owner builds a draft (a draft is in no campaign, so nobody else can read it either).
    if (result.character.role !== 'owner') throw notFound()
    return result.character
  },
  // The draft is edited on this screen; a reload is what brings the server's copy back.
  staleTime: Infinity,
  shouldReload: false,
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.name || 'New character'} · Build · Heart Rush Play` }] }),
  component: BuildPage,
  notFoundComponent: () => (
    <div className="mx-auto w-full max-w-xl px-5 pt-16">
      <h1 className="font-serif text-h2-sm font-semibold">Draft not found</h1>
      <p className="mt-2 text-body-sm text-muted-foreground">It does not exist, or it is not yours.</p>
      <a href="/characters" className="mt-4 inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
        Back to your characters
      </a>
    </div>
  ),
})

function BuildPage() {
  const initial = Route.useLoaderData()
  const draft = useDraft(initial)
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const reachable = reachableStep(draft.builder)
  // Resume at the first unfinished step; a step past it (an old link) shows that step instead.
  const step = Math.min(search.step ?? reachable, reachable) as StepNumber
  const onStep = (next: StepNumber) => void navigate({ search: { step: next } })
  return <BuilderShell key={initial.id} draft={draft} step={step} onStep={onStep} />
}
