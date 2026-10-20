import type { z } from 'zod'
import { NotFoundError, refusalOf, type ConnectedCrouter, type RunObject } from '@north-light/sdk'

/** Identifies a run to its owner: `key` is sent as the idempotency key, and both are stored on the run as `metadata` so it can be found again. */
export type RunTag = { key: string; metadata: Record<string, unknown> }

/** Start a schema run on the person's runtime; `deadline` is how long it may run (for example `15m`). The run id is returned before anything waits on it, so the caller can persist it. */
export async function startRun(
  runtime: ConnectedCrouter,
  prompt: string,
  schema: z.ZodType,
  deadline: string,
  signal?: AbortSignal,
  tag?: RunTag,
): Promise<string> {
  // runs.parse starts and waits in one call and never exposes the run id, so start and wait separately to be able to cancel.
  const run = await runtime.runs.start(
    { prompt, output_schema: schema, scopes: ['crtr:llm', 'crtr:act'], deadline, metadata: tag?.metadata },
    { signal, idempotencyKey: tag?.key },
  )
  return run.run_id
}

const FIND_RUN_LIMIT = 200

/** The run started with `metadata.claim === claim`, among the person's most recently active runs; undefined when there is none. */
export async function findRunByClaim(runtime: ConnectedCrouter, claim: string): Promise<RunObject | undefined> {
  let seen = 0
  for await (const run of runtime.runs.listAll({ limit: 50 })) {
    if (run.metadata?.claim === claim) return run
    if (++seen >= FIND_RUN_LIMIT) break
  }
  return undefined
}

/** Cancel a run and throw when that cannot be confirmed. A run that no longer exists counts as cancelled (returns undefined); a settled run keeps its result. */
export async function cancelRunConfirmed(runtime: ConnectedCrouter, runId: string): Promise<RunObject | undefined> {
  try {
    return await runtime.runs.cancel(runId)
  } catch (error) {
    if (error instanceof NotFoundError) return undefined
    throw error
  }
}

/** Cancel a run, logging instead of throwing: a run that already settled or was deleted needs no cancelling. Returns the run, or undefined when cancelling failed. */
export const cancelRun = (runtime: ConnectedCrouter, runId: string) =>
  runtime.runs.cancel(runId).catch((e) => {
    console.error('could not cancel run', runId, e)
    return undefined
  })

/** The run was cancelled (the GM pressed Stop, or the page left). */
export class RunCanceledError extends Error {
  constructor() {
    super('The run ended without a result: canceled')
  }
}

/** A run's result validated against `schema`; throws when the run ended without one. */
export function resultOf<T extends z.ZodType>(settled: RunObject, schema: T): z.output<T> {
  const outcome = settled.status === 'settled' ? settled.outcome : undefined
  if (outcome?.kind === 'result') return schema.parse(settled.result)
  if (outcome?.reason === 'declined') {
    throw new Error(`The run declined: ${(outcome as { details?: { reason?: string } | null }).details?.reason ?? 'no reason given'}`)
  }
  if (outcome?.reason === 'canceled') throw new RunCanceledError()
  throw new Error(`The run ended without a result: ${outcome?.reason ?? settled.status}`)
}

/** Whether an error means the person must sign in to Northlight again. */
export const needsSignIn = (error: unknown) =>
  refusalOf(error) !== null || (error as { code?: string })?.code === 'not_connected'
