// The builder for a draft (plan row B1a; ruling 8), with the creation assistant beside it. `/characters/new` creates
// the draft (after step 1, or on the assistant's first message); this route edits it until Finish. The current step is
// in the URL (`?step=`) and so is the open tab on phone (`?panel=assistant`), so reload and Back keep the player's place.
import { createFileRoute, notFound, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { AssistantPanel } from '~/components/assistant/AssistantPanel'
import { useAssistant } from '~/components/assistant/use-assistant'
import { BuilderLayout, BuilderShell, showingOf, toPanel, useDesktop, type Panel } from '~/components/builder/BuilderShell'
import { reachableStep, stepOpen, toStep, type StepNumber } from '~/components/builder/draft-rules'
import { useDraft } from '~/components/builder/use-draft'
import { getCharacterFn, type CharacterDoc } from '~/server/characters'

function DraftNotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-16">
      <h1 className="font-serif text-h2-sm font-semibold">Draft not found</h1>
      <p className="mt-2 text-body-sm text-muted-foreground">It does not exist, or it is not yours.</p>
      <a href="/characters" className="mt-4 inline-flex min-h-11 items-center text-ui text-primary underline underline-offset-4">
        Back to your characters
      </a>
    </div>
  )
}

export const Route = createFileRoute('/characters/$id_/build')({
  validateSearch: (search: Record<string, unknown>): { step?: number; panel?: Panel } => ({
    ...(search.step === undefined ? {} : { step: toStep(search.step) }),
    ...(toPanel(search.panel) ? { panel: toPanel(search.panel) } : {}),
  }),
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
  notFoundComponent: DraftNotFound,
})

function BuildPage() {
  const initial = Route.useLoaderData()
  const draft = useDraft(initial)
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const desktop = useDesktop()
  const panel: Panel = search.panel ?? 'builder'
  const assistant = useAssistant({ characterId: initial.id, draft, showing: showingOf(desktop, panel) })
  // The assistant's Applies on this page; the builder writes the step it moved to in again after each.
  const [applied, setApplied] = useState(0)

  // Resume at the first unfinished step; a step the step bar would not open (an old link) shows that step instead.
  const reachable = reachableStep(draft.builder)
  const asked = search.step as StepNumber | undefined
  const step = asked !== undefined && stepOpen(asked, draft.builder, draft.pending) ? asked : reachable

  const onStep = (next: StepNumber) => void navigate({ search: (s) => ({ ...s, step: next }) })
  // Switching tabs replaces the history entry: the URL keeps the tab for reload and Back, without one entry per switch.
  const onPanel = (next: Panel) => void navigate({ search: (s) => ({ ...s, panel: next === 'assistant' ? 'assistant' : undefined }), replace: true })
  const onOpenStep = (next: StepNumber, show: boolean) => {
    if (!show) setApplied((n) => n + 1)
    void navigate({ search: (s) => ({ ...s, step: next, panel: show ? undefined : s.panel }) })
  }

  if (assistant.notFound) return <DraftNotFound />
  return (
    <BuilderLayout
      panel={panel}
      onPanel={onPanel}
      unread={assistant.unread}
      builder={
        <BuilderShell key={initial.id} draft={draft} step={step} onStep={onStep} applied={applied} visible={desktop || panel === 'builder'} />
      }
      assistant={<AssistantPanel assistant={assistant} draft={draft} onOpenStep={onOpenStep} />}
    />
  )
}
