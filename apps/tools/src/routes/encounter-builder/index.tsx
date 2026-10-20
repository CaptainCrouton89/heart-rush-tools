import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'
import { Alert, AlertDescription } from '@heartrush/ui/components/alert'
import { PageShell } from '~/components/page-shell'
import { api, type EncounterSummary } from '~/components/encounter/api'
import { Composer } from '~/components/encounter/composer'
import { PartyLine, type PartyLineHandle } from '~/components/encounter/party-line'
import { SignInPrompt } from '~/components/encounter/sign-in-prompt'
import { runFirstMessageOnLoad } from '~/components/encounter/use-encounter'

const rootRoute = getRouteApi('__root__')

export const Route = createFileRoute('/encounter-builder/')({
  head: () => ({ meta: [{ title: 'Encounter builder · Heart Rush Tools' }] }),
  component: EncounterBuilderIndex,
})

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
/** "5 minutes ago", "yesterday", "3 weeks ago". */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = (Date.parse(iso) - now) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return RTF.format(Math.round(seconds / size), unit)
  return 'just now'
}

function EncounterBuilderIndex() {
  const signedIn = rootRoute.useLoaderData() !== null
  const navigate = useNavigate()
  const [encounters, setEncounters] = useState<EncounterSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const party = useRef<PartyLineHandle>(null)

  const load = useCallback(() => {
    api
      .list()
      .then(setEncounters)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load your encounters'))
  }, [])
  useEffect(() => {
    if (signedIn) load()
  }, [signedIn, load])

  async function start(text: string): Promise<boolean> {
    setCreating(true)
    setError(null)
    try {
      // The run reads the stored party, so the values on screen must be saved first. A failed save shows on the party line.
      if (party.current && !(await party.current.save())) throw new Error('Save the party before starting.')
      const { id } = await api.create(text)
      runFirstMessageOnLoad(id)
      await navigate({ to: '/encounter-builder/$id', params: { id } })
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the encounter')
      setCreating(false)
      return false
    }
  }

  async function remove(enc: EncounterSummary) {
    if (!window.confirm(`Delete “${enc.title}”? This cannot be undone.`)) return
    try {
      await api.remove(enc.id)
      setEncounters((list) => list?.filter((e) => e.id !== enc.id) ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the encounter')
    }
  }

  return (
    <PageShell
      eyebrow="GM tools"
      title="Encounter builder"
      description="Describe a fight and get Heart Rush stat blocks, terrain and scaling notes. Say “make it work” for a finished encounter at once, or think out loud and build it together."
    >
      <div className="max-w-[720px] space-y-10">
        {!signedIn ? (
          <SignInPrompt returnTo="/encounter-builder" />
        ) : (
          <>
            <PartyLine ref={party} />
            <section aria-labelledby="new-heading" className="space-y-3">
              <h2 id="new-heading" className="font-serif text-h4 font-semibold">
                New encounter
              </h2>
              <Composer
                size="large"
                label="Describe the fight"
                placeholder="Describe the fight… e.g. “4 bandits ambush the party on a rope bridge, make it work” or “something creepy in a flooded crypt, not sure what yet”"
                onSend={start}
                disabled={creating}
                sendLabel={creating ? 'Starting…' : 'Start'}
              />
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </section>

            <section aria-labelledby="saved-heading" className="space-y-3">
              <h2 id="saved-heading" className="eyebrow">
                Your encounters
              </h2>
              {encounters === null ? (
                <p className="text-ui text-muted-foreground">Loading…</p>
              ) : encounters.length === 0 ? (
                <p className="font-serif text-body-sm text-muted-foreground">None yet. The ones you build are saved here.</p>
              ) : (
                <ul className="divide-y divide-border border-y border-border">
                  {encounters.map((enc) => (
                    <li key={enc.id} className="flex items-center gap-3">
                      <Link
                        to="/encounter-builder/$id"
                        params={{ id: enc.id }}
                        className="group min-w-0 flex-1 rounded-sm py-4 outline-offset-4"
                      >
                        <span className="block truncate font-serif text-h4 font-semibold text-foreground group-hover:text-primary">
                          {enc.title}
                        </span>
                        <span className="mt-0.5 block text-meta text-muted-foreground">
                          {relativeTime(enc.updated_at)}
                          {!enc.hasDocument && ' · no stat blocks yet'}
                        </span>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => void remove(enc)}
                        aria-label={`Delete ${enc.title}`}
                      >
                        Delete
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </PageShell>
  )
}
