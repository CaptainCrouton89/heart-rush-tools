import { cn } from '@heartrush/ui/lib/utils'
import { STEPS, type StepNumber } from './use-draft'

/**
 * The seven steps in rulebook order. Every step up to `reachable` (the first incomplete one) can be opened, so the
 * player can go back to any earlier step until Finish; later steps wait until the ones before them are done.
 */
export function StepBar({ step, reachable, onStep }: { step: StepNumber; reachable: StepNumber; onStep: (step: StepNumber) => void }) {
  return (
    <nav aria-label="Builder steps" className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <ol className="flex min-w-max gap-1 border-b border-border">
        {STEPS.map((label, i) => {
          const n = (i + 1) as StepNumber
          const current = n === step
          const open = n <= reachable
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
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
