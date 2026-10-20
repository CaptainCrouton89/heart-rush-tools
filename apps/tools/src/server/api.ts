import { authFor } from './auth'

/** The signed-in person for an API request, or the 401 response to return: `{ error, signIn: true }`. */
export async function requireSession(request: Request) {
  const auth = authFor(request)
  const session = await auth.getSession(request)
  if (!session) return { response: Response.json({ error: 'Sign in to use the encounter builder.', signIn: true }, { status: 401 }) }
  return { auth, session }
}

export const notFound = () => Response.json({ error: 'Encounter not found' }, { status: 404 })
