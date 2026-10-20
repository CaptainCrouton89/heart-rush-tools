import type { z } from 'zod'
import { cancelRun, resultOf, startRun } from '@heartrush/northlight/runs'
import type { ConnectedCrouter } from '@north-light/sdk'

/** How long a tools run may take. */
export const RUN_DEADLINE = '15m'

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
  const runId = await startRun(runtime, prompt, schema, RUN_DEADLINE, signal)
  try {
    await onStarted?.(runId)
  } catch (error) {
    await cancelRun(runtime, runId)
    throw error
  }
  return waitForResult(runtime, runId, schema, signal)
}

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
