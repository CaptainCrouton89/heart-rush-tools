import type { BuilderInput, ClientAction } from '@heartrush/rules-engine/types'
import { cn } from '@heartrush/ui/lib/utils'
import { STEPS, stepOpen, stepProblems, type StepNumber } from './draft-rules'

/**
 * The seven steps in rulebook order. A step opens by `stepOpen`: every step up to the first unfinished one, any
 * finished step 1–5 (the assistant may fill steps out of order), and step 6 or 7 once it holds an XP purchase or a
 * gear action. A finished step 1–5 shows a check after its label.
 */
export function StepBar({
  step,
  builder,
  pending,
  onStep,
}: {
  step: StepNumber
  builder: BuilderInput
  pending: readonly ClientAction[]
  onStep: (step: StepNumber) => void
}) {
  return (
    <nav aria-label="Builder steps" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <ol className="flex min-w-max gap-1 border-b border-border">
        {STEPS.map((label, i) => {
          const n = (i + 1) as StepNumber
          const current = n === step
          const open = stepOpen(n, builder, pending)
          const done = n <= 5 && stepProblems(n, builder).length === 0
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!open}
                aria-current={current ? 'step' : undefined}
                onClick={() => onStep(n)}
                className={cn(
                  '-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 font-sans text-ui font-medium whitespace-nowrap transition-colors',
                  current ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-foreground',
                )}
              >
                <span className="tabular-nums">{n}</span>
                <span>{label}</span>
                {done && (
                  <span className="-ml-1 text-meta text-primary">
                    <span aria-hidden="true">✓</span>
                    <span className="sr-only">(complete)</span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
