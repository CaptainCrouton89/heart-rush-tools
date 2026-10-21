import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@heartrush/ui/components/alert'
import { Button } from '@heartrush/ui/components/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@heartrush/ui/components/tabs'
import { cn } from '@heartrush/ui/lib/utils'
import type { AssistantShowing } from '~/components/assistant/use-assistant'
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
import { STEPS, stepProblems, type StepNumber } from './draft-rules'
import type { SaveStatus, UseDraft } from './use-draft'

const STATUS_TEXT: Record<Exclude<SaveStatus['kind'], 'failed'>, string> = { saved: 'Draft saved', saving: 'Saving…', unsaved: 'Saving…' }

/**
 * The builder around one draft: the step bar, the current step, Back / Continue (Continue is refused while the step
 * has problems, which are listed), the draft's save status, and the pending step 6–7 actions the rules now refuse
 * (ruling 8) with a Remove for each. Step 7 ends with Finish instead of Continue. A navigation away from the builder
 * that is held because the last changes did not save asks, in place, whether to stay or leave without them.
 */
export function BuilderShell({ draft, step, onStep }: { draft: UseDraft; step: StepNumber; onStep: (step: StepNumber) => void }) {
  const problems = stepProblems(step, draft.builder)
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)
  useEffect(() => {
    // Moving between steps moves focus to the new step's heading (not on the first render, and not when the step was
    // moved from the assistant's column while focus is there: it stays in the chat).
    if (first.current) first.current = false
    else {
      const active = document.activeElement
      if (!active || active === document.body || root.current?.contains(active)) heading.current?.focus()
    }
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
    <div ref={root} className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-6 md:px-8 md:pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow">{draft.builder.name.trim() || 'New character'}</p>
        <SaveLine status={draft.status} onRetry={() => void draft.flush()} />
      </div>
      <Leaving draft={draft} />
      <StepBar step={step} builder={draft.builder} pending={draft.pending} onStep={go} />
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
            <Button size="compact" type="button" variant="line" onClick={() => go((step - 1) as StepNumber)}>
              Back
            </Button>
          )}
          {step < STEPS.length ? (
            <Button size="compact" variant="line-primary" type="button" disabled={problems.length > 0} onClick={() => go((step + 1) as StepNumber)}>
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
          <Button size="compact" variant="line-primary" type="button" onClick={stay}>
            Stay
          </Button>
          <Button size="compact" type="button" variant="line" onClick={leave}>
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
              <Button size="compact" type="button" variant="line" onClick={() => draft.setPending((p) => p.filter((a) => a.id !== action.id))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

// ---- The page: builder beside the creation assistant ----------------------------------------------

/** Which side the phone layout shows: the `panel` search parameter of both builder routes. */
export type Panel = 'builder' | 'assistant'

/** `?panel=`: `assistant`, else the default (the builder), which the URL leaves out. */
export const toPanel = (value: unknown): Panel | undefined => (value === 'assistant' ? 'assistant' : undefined)

const DESKTOP = '(min-width: 1024px)'

/** True at 1024 px and wider, where builder and assistant are side by side. */
export function useDesktop(): boolean {
  // False until mounted, so the first client render matches the server's.
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(DESKTOP)
    const onChange = () => setDesktop(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return desktop
}

/** What the assistant hook is told is on screen. */
export const showingOf = (desktop: boolean, panel: Panel): AssistantShowing => (desktop ? 'both' : panel)

// Phone: one pane at a time. Desktop: both, whatever the tab says (the SheetLayout pattern).
const PANE = 'data-[state=inactive]:hidden lg:data-[state=inactive]:flex'

/**
 * The builder page (design "Builder layout"). At 1024 px and wider: the builder on the left and the assistant in a
 * 400 px column on the right, sticky under the site header, scrolling on its own with its composer at the bottom.
 * Narrower: the tabs **Builder** and **Assistant** under the header, `panel` choosing the open one, and a dot on a
 * tab that has something new (`unread`).
 */
export function BuilderLayout({
  panel,
  onPanel,
  unread,
  builder,
  assistant,
}: {
  panel: Panel
  onPanel: (panel: Panel) => void
  unread: { builder: boolean; assistant: boolean }
  builder: ReactNode
  assistant: ReactNode
}) {
  return (
    <Tabs
      value={panel}
      onValueChange={(v) => onPanel(v === 'assistant' ? 'assistant' : 'builder')}
      // Desktop: the page's bottom padding moves inside the grid, so the sticky column can stay under the header to the end.
      className="mx-auto w-full max-w-6xl gap-0 lg:-mb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start"
    >
      <div className="sticky top-14 z-20 bg-background md:top-16 lg:hidden">
        <TabsList aria-label="Builder or assistant" className="px-5 md:px-8">
          <PaneTab value="builder" label="Builder" dot={unread.builder} dotText="changed by the assistant" />
          <PaneTab value="assistant" label="Assistant" dot={unread.assistant} dotText="new reply" />
        </TabsList>
      </div>
      <TabsContent value="builder" forceMount className={cn('flex min-w-0 flex-col lg:pb-16', PANE)}>
        {builder}
      </TabsContent>
      <TabsContent
        value="assistant"
        forceMount
        className={cn(
          // Phone: the space under the header and tabs, so the composer sits at the bottom of the screen (the page's
          // bottom padding is taken back). Desktop: the column's full height under the header.
          'flex h-[calc(100dvh-6.25rem)] flex-col max-lg:-mb-16 md:h-[calc(100dvh-6.75rem)]',
          'lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:border-l lg:border-border',
          PANE,
        )}
      >
        {assistant}
      </TabsContent>
    </Tabs>
  )
}

function PaneTab({ value, label, dot, dotText }: { value: Panel; label: string; dot: boolean; dotText: string }) {
  return (
    <TabsTrigger value={value} className="flex-1">
      {label}
      {dot && (
        <span className="size-2 rounded-full bg-primary">
          <span className="sr-only">({dotText})</span>
        </span>
      )}
    </TabsTrigger>
  )
}
