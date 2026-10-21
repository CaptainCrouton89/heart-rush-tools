// The one line every AI control shows when a call gives no result (design "AI features"; Key flow 10): the reason in
// plain words and **Retry**, or **Sign in again** when the person's Northlight connection is gone (`not_connected`).
import { useLocation } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'
import type { AiFailure as AiFailureReason, AiRefusal } from '~/server/ai'

/** Why a call gave no result: a run that ended without one, a refusal from the server, or no answer at all. */
export type AiProblem = { kind: 'failed'; reason: AiFailureReason } | AiRefusal | { kind: 'unreachable' }

const FAILED: Record<AiFailureReason, (deadline: string) => string> = {
  declined: () => 'your Northlight runtime declined the request',
  deadline_exceeded: (deadline) => `no answer within ${deadline}`,
  runtime_error: () => 'the AI run failed',
  not_connected: () => 'your Northlight connection has ended',
}

/** `deadline` is how long the run had, in words: 60 seconds for `runAi`, 15 minutes for the creation assistant. */
export function problemText(p: AiProblem, deadline = '60 seconds'): string {
  if (p.kind === 'failed') return FAILED[p.reason](deadline)
  if (p.kind === 'unreachable') return 'no connection to the server'
  const m = p.message.trim().replace(/\.$/, '')
  return m.charAt(0).toLowerCase() + m.slice(1)
}

/** `verb` starts the line: "Couldn't explain: …". `deadline` words the run's time limit (default "60 seconds"). */
export function AiFailureLine({ problem, verb, onRetry, deadline }: { problem: AiProblem; verb: string; onRetry: () => void; deadline?: string }) {
  const { pathname, searchStr } = useLocation()
  const signIn = problem.kind === 'failed' && problem.reason === 'not_connected'
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="min-w-0 flex-1 text-ui text-muted-foreground">
        Couldn't {verb}: {problemText(problem, deadline)}.
      </p>
      {signIn ? (
        <Button size="compact" asChild variant="line">
          <a href={`/auth/login?returnTo=${encodeURIComponent(pathname + searchStr)}`}>Sign in again</a>
        </Button>
      ) : (
        <Button size="compact" type="button" variant="line" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

/** "Thinking…" in place while a run is out. */
export function Thinking() {
  return (
    <p role="status" aria-live="polite" className="flex min-h-11 items-center text-ui text-muted-foreground">
      Thinking…
    </p>
  )
}
