// The one line every AI control shows when a call gives no result (design "AI features"; Key flow 10): the reason in
// plain words and **Retry**, or **Sign in again** when the person's Northlight connection is gone (`not_connected`).
import { useLocation } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'
import type { AiFailure as AiFailureReason, AiRefusal } from '~/server/ai'

/** Why a call gave no result: a run that ended without one, a refusal from the server, or no answer at all. */
export type AiProblem = { kind: 'failed'; reason: AiFailureReason } | AiRefusal | { kind: 'unreachable' }

const FAILED: Record<AiFailureReason, string> = {
  declined: 'your Northlight runtime declined the request',
  deadline_exceeded: 'no answer within 60 seconds',
  runtime_error: 'the AI run failed',
  not_connected: 'your Northlight connection has ended',
}

export function problemText(p: AiProblem): string {
  if (p.kind === 'failed') return FAILED[p.reason]
  if (p.kind === 'unreachable') return 'no connection to the server'
  const m = p.message.trim().replace(/\.$/, '')
  return m.charAt(0).toLowerCase() + m.slice(1)
}

/** `verb` starts the line: "Couldn't explain: …". */
export function AiFailureLine({ problem, verb, onRetry }: { problem: AiProblem; verb: string; onRetry: () => void }) {
  const { pathname, searchStr } = useLocation()
  const signIn = problem.kind === 'failed' && problem.reason === 'not_connected'
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="min-w-0 flex-1 text-ui text-muted-foreground">
        Couldn't {verb}: {problemText(problem)}.
      </p>
      {signIn ? (
        <Button asChild size="lg" variant="outline" className="min-h-11">
          <a href={`/auth/login?returnTo=${encodeURIComponent(pathname + searchStr)}`}>Sign in again</a>
        </Button>
      ) : (
        <Button type="button" size="lg" variant="outline" className="min-h-11" onClick={onRetry}>
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
