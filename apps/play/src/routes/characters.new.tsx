// Builder step 1 (plan row B1a). The draft row is created when the player continues past step 1; steps 2–7 and every
// later visit are `/characters/$id/build`.
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { ulid } from 'ulid'
import { Alert, AlertDescription } from '@heartrush/ui/components/alert'
import { Button } from '@heartrush/ui/components/button'
import { StepBar } from '~/components/builder/StepBar'
import { StepDream, type DreamFields } from '~/components/builder/StepDream'
import { newBuilder, stepProblems, STEPS } from '~/components/builder/use-draft'
import { NO_CONNECTION_TEXT, refusalReason } from '~/components/sheet/refusal-text'
import { createDraftFn } from '~/server/characters'

export const Route = createFileRoute('/characters/new')({
  beforeLoad: ({ context, location }) => {
    if (!context.session) throw redirect({ href: `/auth/login?returnTo=${encodeURIComponent(location.href)}` })
  },
  head: () => ({ meta: [{ title: 'New character · Heart Rush Play' }] }),
  component: NewCharacter,
})

function NewCharacter() {
  const navigate = useNavigate()
  const create = useServerFn(createDraftFn)
  const [fields, setFields] = useState<DreamFields>({ name: '', pronouns: '', dream: '', portrait: null })
  // One id per visit: a retry after a failed request creates the same draft, not a second one.
  const [id] = useState(() => ulid())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const builder = newBuilder(id, new Date().toISOString(), fields)
  const problems = stepProblems(1, builder)

  async function onContinue() {
    if (problems.length > 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await create({ data: { builder: { ...builder, name: builder.name.trim() } } })
      // duplicate_id: an earlier attempt created this draft and only its answer was lost; continue to it.
      if (!result.ok && result.code !== 'duplicate_id') {
        setError(`Not saved: ${refusalReason(result.code, result.message)}`)
        return
      }
      await navigate({ to: '/characters/$id/build', params: { id }, search: { step: 2 } })
    } catch {
      setError(NO_CONNECTION_TEXT)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-6 md:px-8 md:pt-10">
      <p className="eyebrow">New character</p>
      <StepBar step={1} reachable={1} onStep={() => {}} />
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
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {problems.length > 0 && (
            <ul className="list-disc pl-5 text-ui text-muted-foreground" aria-live="polite">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <Button type="submit" size="lg" className="self-start" disabled={problems.length > 0 || busy}>
            {busy ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </form>
    </div>
  )
}
