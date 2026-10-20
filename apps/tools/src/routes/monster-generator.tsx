import { useEffect, useState } from 'react'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Button } from '@heartrush/ui/components/button'
import { Textarea } from '@heartrush/ui/components/textarea'
import { Alert, AlertDescription, AlertTitle } from '@heartrush/ui/components/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@heartrush/ui/components/card'
import { MonsterStatBlock } from '~/components/monster-stat-block'
import { generateMarkdown } from '~/monster/markdown'
import { monsterSchema, type MonsterStatBlock as Monster } from '~/monster/schema'
import type { MonsterEvent } from '~/routes/api/monster'

const rootRoute = getRouteApi('__root__')

export const Route = createFileRoute('/monster-generator')({
  head: () => ({ meta: [{ title: 'Monster Generator · Heart Rush Tools' }] }),
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
  const [copied, setCopied] = useState(false)
  const loading = stage !== null

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
    try {
      const response = await fetch('/api/monster', {
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
      setError({ message: e instanceof Error ? e.message : 'Failed to generate monster' })
    } finally {
      setStage(null)
    }
  }

  async function copy() {
    if (!monster) return
    await navigator.clipboard.writeText(generateMarkdown(monster))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-4xl font-bold">Monster Generator</h1>
      <p className="mb-8 text-lg text-muted-foreground">
        Generate custom monster stat blocks using AI, from simple minions to multi-part bosses.
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          {!signedIn && (
            <Alert>
              <AlertTitle>Sign in to generate monsters</AlertTitle>
              <AlertDescription>
                Generation runs on your own Northlight account and AI subscription, not on a shared key, so the tool
                needs to know whose account to use.{' '}
                <a className="underline" href="/auth/login?returnTo=/monster-generator">
                  Sign in with Northlight
                </a>
                .
              </AlertDescription>
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Monster Concept</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void generate()
                }}
              >
                <label htmlFor="concept" className="block text-sm font-medium">
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
                  placeholder="A shadowy wolf that can phase through walls, hunting in abandoned buildings… (Cmd+Enter to submit)"
                  className="h-32 resize-none"
                  disabled={loading}
                  required
                />
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {error.message}{' '}
                      {error.signIn && (
                        <a className="underline" href="/auth/login?returnTo=/monster-generator">
                          Sign in
                        </a>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={loading || !signedIn || !concept.trim()}>
                  {loading ? 'Generating…' : 'Generate Monster'}
                </Button>
                {loading && stage && (
                  <p role="status" className="text-center text-xs text-muted-foreground">
                    {STAGE_LABEL[stage]} {elapsed}s elapsed. Two runs on your Northlight account; this can take a few
                    minutes.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Tips for Better Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                <li>Be specific about the monster’s abilities and behavior</li>
                <li>Mention the intended challenge level (minion, standard, elite, boss)</li>
                <li>Include unique traits that make it tactically interesting</li>
                <li>For complex monsters, describe component relationships</li>
                <li>Consider its role in your story or encounter</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Example Concepts</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm text-muted-foreground">
                {EXAMPLES.map(([kind, text]) => (
                  <div key={kind}>
                    <dt className="inline font-bold">{kind}:</dt> <dd className="inline">“{text}”</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>

        <section aria-label="Output">
          {monster && <MonsterStatBlock monster={monster} copied={copied} onCopy={() => void copy()} />}
          {!monster && !loading && (
            <Card className="bg-muted/30">
              <CardContent className="text-center text-muted-foreground">
                Enter a monster concept to generate a stat block
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  )
}
