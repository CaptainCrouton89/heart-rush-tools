import type { Encounter, Party, StoredMessage } from '~/encounter/schema'
import type { EncounterEvent } from '~/routes/api/encounters/$id/messages'

/** `GET /api/encounters/:id`. */
export type EncounterDetail = {
  id: string
  title: string
  messages: StoredMessage[]
  document: Encounter | null
  running: boolean
}

/** One row of `GET /api/encounters`. */
export type EncounterSummary = { id: string; title: string; updated_at: string; hasDocument: boolean }

export type AgentMessage = Extract<StoredMessage, { role: 'agent' }>

/** A failed API call. `signIn` is true when the route answered 401 or asked for a fresh Northlight sign-in. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly signIn: boolean,
  ) {
    super(message)
  }
}

async function errorOf(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { error?: string; signIn?: boolean } | null
  return new ApiError(body?.error ?? `Request failed (${res.status})`, res.status, res.status === 401 || body?.signIn === true)
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) throw await errorOf(res)
  return (await res.json()) as T
}

const jsonBody = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  party: () => call<Party>('/api/party'),
  saveParty: (party: Party) => call<Party>('/api/party', jsonBody('PUT', party)),
  list: () => call<EncounterSummary[]>('/api/encounters'),
  /** A new encounter holding the GM's first message; the encounter page then runs it. */
  create: (text: string) => call<{ id: string }>('/api/encounters', jsonBody('POST', { text })),
  get: (id: string) => call<EncounterDetail>(`/api/encounters/${encodeURIComponent(id)}`),
  remove: (id: string) => call<{ ok: true }>(`/api/encounters/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /** 200 `{ok: true}` once the run is confirmed cancelled; 202 `{ok: false, stopping: true}` while it is still starting (poll `get`). A 502 throws. */
  stop: (id: string) =>
    call<{ ok: boolean; stopped?: boolean; stopping?: boolean }>(`/api/encounters/${encodeURIComponent(id)}/stop`, { method: 'POST' }),
}

/** Post a GM message and yield the NDJSON events the route streams back. Throws `ApiError` when the route refuses it (400, 401, 404, 409). */
export async function* postMessage(id: string, text: string): AsyncGenerator<EncounterEvent> {
  const res = await fetch(`/api/encounters/${encodeURIComponent(id)}/messages`, jsonBody('POST', { text }))
  if (!res.ok || !res.body) throw await errorOf(res)
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as EncounterEvent
  }
  if (buffer.trim()) yield JSON.parse(buffer) as EncounterEvent
}
