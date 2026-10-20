import { useEffect, useRef, type ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@heartrush/ui/components/alert'
import { Button } from '@heartrush/ui/components/button'
import { describeAction } from '~/components/sheet/HistoryList'
import { refusalReason } from '~/components/sheet/refusal-text'
import { FinishBar } from './FinishBar'
import { StepAspects } from './StepAspects'
import { StepBar } from './StepBar'
import { StepDream } from './StepDream'
import { StepGear } from './StepGear'
import { StepKin } from './StepKin'
import { StepProfessions } from './StepProfessions'
import { StepTalents } from './StepTalents'
import { StepVitals } from './StepVitals'
import { STEPS, reachableStep, stepProblems, type SaveStatus, type StepNumber, type UseDraft } from './use-draft'

const STATUS_TEXT: Record<Exclude<SaveStatus['kind'], 'failed'>, string> = { saved: 'Draft saved', saving: 'Saving…', unsaved: 'Saving…' }

/**
 * The builder around one draft: the step bar, the current step, Back / Continue (Continue is refused while the step
 * has problems, which are listed), the draft's save status, and the pending step 6–7 actions the rules now refuse
 * (ruling 8) with a Remove for each. Step 7 ends with Finish instead of Continue. A navigation away from the builder
 * that is held because the last changes did not save asks, in place, whether to stay or leave without them.
 */
export function BuilderShell({ draft, step, onStep }: { draft: UseDraft; step: StepNumber; onStep: (step: StepNumber) => void }) {
  const reachable = reachableStep(draft.builder)
  const problems = stepProblems(step, draft.builder)
  const heading = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)
  useEffect(() => {
    // Moving between steps moves focus to the new step's heading (not on the first render).
    if (first.current) first.current = false
    else heading.current?.focus()
  }, [step])

  const go = (next: StepNumber) => {
    void draft.flush()
    onStep(next)
  }

  let body: ReactNode
  switch (step) {
    case 1:
      body = <StepDream value={draft.builder} onChange={(patch) => draft.update(patch)} />
      break
    case 2:
      body = <StepKin draft={draft} />
      break
    case 3:
      body = <StepVitals draft={draft} />
      break
    case 4:
      body = <StepProfessions draft={draft} />
      break
    case 5:
      body = <StepAspects draft={draft} />
      break
    case 6:
      body = <StepTalents draft={draft} />
      break
    case 7:
      body = <StepGear draft={draft} />
      break
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-6 md:px-8 md:pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow">{draft.builder.name.trim() || 'New character'}</p>
        <SaveLine status={draft.status} onRetry={() => void draft.flush()} />
      </div>
      <Leaving draft={draft} />
      <StepBar step={step} reachable={reachable} onStep={go} />
      <h1 ref={heading} tabIndex={-1} className="font-serif text-h1-sm font-semibold outline-none md:text-h1">
        {step}. {STEPS[step - 1]}
      </h1>

      <InvalidPending draft={draft} />

      {body}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        {problems.length > 0 && (
          <ul className="list-disc pl-5 text-ui text-muted-foreground" aria-live="polite">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {step > 1 && (
            <Button type="button" variant="outline" size="lg" onClick={() => go((step - 1) as StepNumber)}>
              Back
            </Button>
          )}
          {step < STEPS.length ? (
            <Button type="button" size="lg" disabled={problems.length > 0} onClick={() => go((step + 1) as StepNumber)}>
              Continue
            </Button>
          ) : (
            <FinishBar draft={draft} />
          )}
        </div>
      </div>
    </div>
  )
}

function SaveLine({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status.kind !== 'failed') {
    return (
      <p className="text-meta text-muted-foreground" aria-live="polite">
        {STATUS_TEXT[status.kind]}
      </p>
    )
  }
  return (
    <p className="flex items-center gap-2 text-meta text-destructive" role="alert">
      {status.text}
      <Button type="button" variant="link" className="min-h-11 text-meta" onClick={onRetry}>
        Retry
      </Button>
    </p>
  )
}

/** A held navigation away from the builder (`draft.leaving`): the changes on screen did not save. */
function Leaving({ draft }: { draft: UseDraft }) {
  const alert = useRef<HTMLDivElement>(null)
  const held = draft.leaving !== null
  useEffect(() => {
    if (held) alert.current?.scrollIntoView({ block: 'center' })
  }, [held])
  if (!draft.leaving) return null
  const { stay, leave } = draft.leaving
  return (
    <Alert ref={alert} variant="destructive" role="alert">
      <AlertTitle>Your latest changes are not saved</AlertTitle>
      <AlertDescription>
        <p>{draft.status.kind === 'failed' ? `${draft.status.text}.` : ''} If you leave now, they are lost.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button type="button" size="lg" onClick={stay}>
            Stay
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={leave}>
            Leave without saving
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

/** Ruling 8: a step 6–7 action an earlier edit made invalid, with the refusal reason. Finish stays disabled until it is removed. */
function InvalidPending({ draft }: { draft: UseDraft }) {
  const { invalid } = draft.preview
  if (invalid.length === 0) return null
  return (
    <Alert variant="destructive">
      <AlertTitle>
        {invalid.length === 1 ? 'A talent or gear change is' : `${invalid.length} talent or gear changes are`} no longer allowed
      </AlertTitle>
      <AlertDescription>
        <ul className="flex flex-col gap-1">
          {invalid.map(({ action, code, message }) => (
            <li key={action.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {describeAction(action)}: {refusalReason(code, message)}
              </span>
              <Button type="button" variant="outline" size="lg" onClick={() => draft.setPending((p) => p.filter((a) => a.id !== action.id))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
