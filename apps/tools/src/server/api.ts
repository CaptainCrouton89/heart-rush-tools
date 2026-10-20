import { authFor } from './auth'

/** The signed-in person for an API request, or the 401 response to return: `{ error, signIn: true }`. */
export async function requireSession(request: Request) {
  const auth = authFor(request)
  const session = await auth.getSession(request)
  if (!session) return { response: Response.json({ error: 'Sign in to use the encounter builder.', signIn: true }, { status: 401 }) }
  return { auth, session }
}

export const notFound = () => Response.json({ error: 'Encounter not found' }, { status: 404 })

/** A `campaignId` from a request body: a play campaign id, or null for the typed party. Undefined when it is neither. */
export function campaignIdOf(value: unknown): string | null | undefined {
  if (value === null) return null
  return typeof value === 'string' && value.length > 0 && value.length <= 100 ? value : undefined
}
