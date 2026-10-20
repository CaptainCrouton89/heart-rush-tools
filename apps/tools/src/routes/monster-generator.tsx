import { useEffect, useRef, useState } from 'react'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'
import { Textarea } from '@heartrush/ui/components/textarea'
import { Alert, AlertDescription, AlertTitle } from '@heartrush/ui/components/alert'
import { MonsterStatBlock } from '~/components/monster-stat-block'
import { PageShell } from '~/components/page-shell'
import { monsterSchema, type MonsterStatBlock as Monster } from '~/monster/schema'
import type { MonsterEvent } from '~/routes/api/monster'

const rootRoute = getRouteApi('__root__')

export const Route = createFileRoute('/monster-generator')({
  head: () => ({ meta: [{ title: 'Monster generator · Heart Rush Tools' }] }),
  component: MonsterGeneratorPage,
})

const STAGE_LABEL = {
  analyzing: 'Step 1 of 2: judging the monster’s level, ability count and health…',
  generating: 'Step 2 of 2: writing the full stat block…',
} as const

const EXAMPLES = [
  ['Simple', 'A pack of spectral wolves that phase through walls'],
  ['Elite', 'A corrupted tree that controls vines and spreads poison spores'],
  ['Boss', 'An ancient lich with multiple phylacteries hidden around the battlefield'],
  ['Multi-part', 'A massive spider with destructible legs and a vulnerable core'],
] as const

function MonsterGeneratorPage() {
  const signedIn = rootRoute.useLoaderData() !== null
  const [concept, setConcept] = useState('')
  const [stage, setStage] = useState<keyof typeof STAGE_LABEL | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [monster, setMonster] = useState<Monster | null>(null)
  const [error, setError] = useState<{ message: string; signIn?: boolean } | null>(null)
  const loading = stage !== null
  const controllerRef = useRef<AbortController | null>(null)

  // Leaving the page aborts the request, which stops the runs on the server.
  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [loading])

  async function generate() {
    if (!concept.trim()) return setError({ message: 'Please enter a monster concept' })
    setError(null)
    setMonster(null)
    setStage('analyzing')
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const response = await fetch('/api/monster', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ concept }),
      })
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError({ message: body?.error ?? `Request failed (${response.status})`, signIn: response.status === 401 })
        return
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as MonsterEvent
          if (event.type === 'stage') setStage(event.stage)
          else if (event.type === 'result') setMonster(monsterSchema.parse(event.monster))
          else setError({ message: event.message, signIn: event.signIn })
        }
      }
    } catch (e) {
      if (controller.signal.aborted) return
      setError({ message: e instanceof Error ? e.message : 'Failed to generate monster' })
    } finally {
      if (!controller.signal.aborted) setStage(null)
    }
  }

  return (
    <PageShell
      eyebrow="GM tools"
      title="Monster generator"
      description="Describe a creature and get a Heart Rush stat block, from a single minion to a multi-part boss."
    >
      {/* DOM order is form, result, examples: on a phone the result lands right under the button. */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12">
        <div className="print-hidden space-y-8 lg:col-start-1 lg:row-start-1">
          {!signedIn && (
            <Alert>
              <AlertTitle>Sign in to generate monsters</AlertTitle>
              <AlertDescription>
                Generation runs on your own Northlight account and AI subscription, not on a shared key, so the tool
                needs to know whose account to use.{' '}
                <a className="text-primary underline underline-offset-2" href="/auth/login?returnTo=/monster-generator">
                  Sign in with Northlight
                </a>
                .
              </AlertDescription>
            </Alert>
          )}

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void generate()
            }}
          >
            <label htmlFor="concept" className="block text-control font-semibold">
              Describe your monster
            </label>
            <Textarea
              id="concept"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  if (!loading && signedIn && concept.trim()) void generate()
                }
              }}
              placeholder="A shadowy wolf that can phase through walls, hunting in abandoned buildings…"
              aria-describedby="concept-hint"
              className="h-36 resize-y"
              disabled={loading}
              required
            />
            <p id="concept-hint" className="text-meta text-muted-foreground">
              Press <kbd className="font-sans font-medium">⌘ Enter</kbd> or{' '}
              <kbd className="font-sans font-medium">Ctrl Enter</kbd> to generate.
            </p>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error.message}{' '}
                  {error.signIn && (
                    <a className="text-primary underline underline-offset-2" href="/auth/login?returnTo=/monster-generator">
                      Sign in
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={loading || !signedIn || !concept.trim()}>
              {loading ? 'Generating…' : 'Generate monster'}
            </Button>
            {loading && stage && (
              <p role="status" className="text-ui text-foreground">
                {STAGE_LABEL[stage]}
                <span className="mt-1 block text-meta text-muted-foreground">
                  <span className="tabular-nums">{elapsed}s</span> elapsed. Two runs on your Northlight account; this
                  can take a few minutes.
                </span>
              </p>
            )}
          </form>
        </div>

        <section
          aria-label="Generated monster"
          className="min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          {monster ? (
            <MonsterStatBlock monster={monster} />
          ) : (
            <div className="print-hidden flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-6 py-10 text-center">
              <p className="text-ui text-muted-foreground">
                {loading ? 'Generating your stat block…' : 'Your stat block will appear here.'}
              </p>
            </div>
          )}
        </section>

        <div className="print-hidden space-y-8 lg:col-start-1 lg:row-start-2">
          <section aria-labelledby="examples-heading" className="space-y-2">
            <h2 id="examples-heading" className="eyebrow">
              Example concepts
            </h2>
            <ul className="divide-y divide-border border-y border-border">
              {EXAMPLES.map(([kind, text]) => (
                <li key={kind} className="py-3">
                  <span className="block text-meta font-semibold text-muted-foreground">{kind}</span>
                  <span className="block font-serif text-body-sm text-foreground">“{text}”</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="tips-heading" className="space-y-2">
            <h2 id="tips-heading" className="eyebrow">
              Tips for better results
            </h2>
            <ul className="list-disc space-y-1 pl-5 font-serif text-body-sm text-muted-foreground marker:text-border">
              <li>Be specific about the monster’s abilities and behavior</li>
              <li>Mention the intended challenge level (minion, standard, elite, boss)</li>
              <li>Include unique traits that make it tactically interesting</li>
              <li>For complex monsters, describe component relationships</li>
              <li>Consider its role in your story or encounter</li>
            </ul>
          </section>
        </div>
      </div>
    </PageShell>
  )
}
