import type { z } from 'zod'
import { NotFoundError, refusalOf, type ConnectedCrouter, type RunObject } from '@north-light/sdk'

const RUN_DEADLINE = '15m'

/** Identifies a run to its owner: `key` is sent as the idempotency key, and both are stored on the run as `metadata` so it can be found again. */
export type RunTag = { key: string; metadata: Record<string, unknown> }

/** Start a schema run on the person's runtime. The run id is returned before anything waits on it, so the caller can persist it. */
export async function startRun(
  runtime: ConnectedCrouter,
  prompt: string,
  schema: z.ZodType,
  signal?: AbortSignal,
  tag?: RunTag,
): Promise<string> {
  // runs.parse starts and waits in one call and never exposes the run id, so start and wait separately to be able to cancel.
  const run = await runtime.runs.start(
    { prompt, output_schema: schema, scopes: ['crtr:llm', 'crtr:act'], deadline: RUN_DEADLINE, metadata: tag?.metadata },
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

/** Wait for a started run and return its validated result. Aborting `signal` stops waiting and cancels the run, since the SDK leaves it running. */
export async function waitForResult<T extends z.ZodType>(
  runtime: ConnectedCrouter,
  runId: string,
  schema: T,
  signal: AbortSignal,
): Promise<z.output<T>> {
  try {
    return resultOf(await runtime.runs.wait(runId, { signal }), schema)
  } catch (error) {
    if (signal.aborted) await cancelRun(runtime, runId)
    throw error
  }
}

/** Start one run and wait for its result. `onStarted` receives the run id once it exists. */
export async function runSchema<T extends z.ZodType>(
  runtime: ConnectedCrouter,
  prompt: string,
  schema: T,
  signal: AbortSignal,
  onStarted?: (runId: string) => void | Promise<void>,
): Promise<z.output<T>> {
  const runId = await startRun(runtime, prompt, schema, signal)
  try {
    await onStarted?.(runId)
  } catch (error) {
    await cancelRun(runtime, runId)
    throw error
  }
  return waitForResult(runtime, runId, schema, signal)
}

/** Whether an error means the person must sign in to Northlight again. */
export const needsSignIn = (error: unknown) =>
  refusalOf(error) !== null || (error as { code?: string })?.code === 'not_connected'

/** Open the NDJSON response both AI routes stream. `body` receives `send` and the abort signal (fired when the browser leaves); it must never touch the stream itself. */
export function ndjsonResponse<E>(
  request: Request,
  body: (send: (event: E) => void, signal: AbortSignal) => Promise<void>,
): Response {
  const encoder = new TextEncoder()
  const abort = new AbortController()
  request.signal.addEventListener('abort', () => abort.abort(), { once: true })
  let open = true // false once the browser has gone: the controller is closed and must not be touched
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await body((event) => {
          if (open) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
        }, abort.signal)
      } finally {
        if (open) controller.close()
      }
    },
    cancel() {
      open = false
      abort.abort()
    },
  })
  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  })
}
