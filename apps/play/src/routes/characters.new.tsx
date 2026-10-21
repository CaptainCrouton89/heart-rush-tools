// Builder step 1 (plan row B1a) with the creation assistant beside it. The draft row is created when the player
// continues past step 1, or when they send the assistant its first message (then step 1 may still be empty); steps 2–7
// and every later visit are `/characters/$id/build`.
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import { ulid } from 'ulid'
import { Alert, AlertDescription } from '@heartrush/ui/components/alert'
import { Button } from '@heartrush/ui/components/button'
import { AssistantPanel } from '~/components/assistant/AssistantPanel'
import { useAssistant } from '~/components/assistant/use-assistant'
import { BuilderLayout, showingOf, toPanel, useDesktop, type Panel } from '~/components/builder/BuilderShell'
import { StepBar } from '~/components/builder/StepBar'
import { StepDream, type DreamFields } from '~/components/builder/StepDream'
import { newBuilder, stepProblems, STEPS, type StepNumber } from '~/components/builder/draft-rules'
import { NO_CONNECTION_TEXT, refusalReason } from '~/components/sheet/refusal-text'
import { createDraftFn } from '~/server/characters'

export const Route = createFileRoute('/characters/new')({
  validateSearch: (search: Record<string, unknown>): { panel?: Panel } => (toPanel(search.panel) ? { panel: toPanel(search.panel) } : {}),
  beforeLoad: ({ context, location }) => {
    if (!context.session) throw redirect({ href: `/auth/login?returnTo=${encodeURIComponent(location.href)}` })
  },
  head: () => ({ meta: [{ title: 'New character · Heart Rush Play' }] }),
  component: NewCharacter,
})

function NewCharacter() {
  const navigate = useNavigate({ from: Route.fullPath })
  const create = useServerFn(createDraftFn)
  const search = Route.useSearch()
  const desktop = useDesktop()
  const panel: Panel = search.panel ?? 'builder'
  const [fields, setFields] = useState<DreamFields>({ name: '', pronouns: '', dream: '', portrait: null })
  // One id per visit: a retry after a failed request creates the same draft, not a second one.
  const [id] = useState(() => ulid())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const builder = newBuilder(id, new Date().toISOString(), fields)
  const problems = stepProblems(1, builder)
  const latest = useRef(builder)
  latest.current = builder

  /** Creates this visit's draft from what step 1 holds; null (with the reason shown) when it could not. */
  async function createDraft(b: typeof builder): Promise<string | null> {
    setError(null)
    try {
      const result = await create({ data: { builder: { ...b, name: b.name.trim() } } })
      // duplicate_id: an earlier attempt created this draft and only its answer was lost; carry on with it.
      if (!result.ok && result.code !== 'duplicate_id') {
        setError(`Not saved: ${refusalReason(result.code, result.message)}`)
        return null
      }
      return id
    } catch {
      setError(NO_CONNECTION_TEXT)
      return null
    }
  }

  // The assistant's first message creates the draft (the name may still be empty), then the build page opens with
  // the chat showing, whether or not the send succeeded: it shows the stored message and any failure with Retry.
  const assistant = useAssistant({
    characterId: null,
    draft: null,
    showing: showingOf(desktop, panel),
    createDraft: () => createDraft(latest.current),
    afterFirstSend: (draftId) => void navigate({ to: '/characters/$id/build', params: { id: draftId }, search: { panel: 'assistant' } }),
  })

  async function onContinue(step: StepNumber = 2) {
    if (problems.length > 0 || busy) return
    setBusy(true)
    try {
      if (await createDraft(builder)) await navigate({ to: '/characters/$id/build', params: { id }, search: { step } })
    } finally {
      setBusy(false)
    }
  }

  const notice = error && (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )

  return (
    <BuilderLayout
      panel={panel}
      onPanel={(next) => void navigate({ search: next === 'assistant' ? { panel: 'assistant' } : {}, replace: true })}
      unread={assistant.unread}
      builder={
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-6 md:px-8 md:pt-10">
          <p className="eyebrow">New character</p>
          <StepBar step={1} builder={builder} pending={[]} onStep={(n) => n !== 1 && void onContinue(n)} />
          <h1 className="font-serif text-h1-sm font-semibold md:text-h1">1. {STEPS[0]}</h1>
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void onContinue()
            }}
          >
            <StepDream value={fields} onChange={(patch) => setFields((f) => ({ ...f, ...patch }))} />
            {notice}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              {problems.length > 0 && (
                <ul className="list-disc pl-5 text-ui text-muted-foreground" aria-live="polite">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              <Button size="compact" variant="line-primary" type="submit" className="self-start" disabled={problems.length > 0 || busy}>
                {busy ? 'Saving…' : 'Continue'}
              </Button>
            </div>
          </form>
        </div>
      }
      assistant={
        <div className="flex h-full min-h-0 flex-col">
          {/* On phone the builder's alert is out of sight: a draft that could not be made shows here too. */}
          {!desktop && panel === 'assistant' && notice && <div className="px-5 pt-4">{notice}</div>}
          <div className="min-h-0 flex-1">
            <AssistantPanel assistant={assistant} draft={null} onOpenStep={() => {}} />
          </div>
        </div>
      }
    />
  )
}
