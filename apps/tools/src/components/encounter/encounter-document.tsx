import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@heartrush/ui/components/button'
import type { Encounter } from '~/encounter/schema'
import { MonsterStatBlock } from '~/components/monster-stat-block'
import { withDice } from '~/monster/format'
import { encounterMarkdown } from './markdown'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-5">
      <h3 className="eyebrow">{title}</h3>
      {children}
    </section>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{withDice(item)}</li>
      ))}
    </ul>
  )
}

function CopyEncounterButton({ encounter }: { encounter: Encounter }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  async function copy() {
    clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(encounterMarkdown(encounter))
      setState('copied')
    } catch {
      setState('failed')
    }
    timer.current = setTimeout(() => setState('idle'), 2000)
  }
  return (
    <Button variant="outline" size="sm" onClick={() => void copy()}>
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy Markdown'}</span>
    </Button>
  )
}

/** The actions above the document. Off paper. */
export function DocumentActions({ encounter }: { encounter: Encounter }) {
  return (
    <div className="print-hidden flex flex-wrap items-center gap-2">
      <CopyEncounterButton encounter={encounter} />
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        Print
      </Button>
    </div>
  )
}

/**
 * The current encounter as one document: title, summary, enemies (count × stat block), terrain, tactics (only when
 * there are any), hooks and scaling. This is all that prints.
 */
export function EncounterDocument({ encounter }: { encounter: Encounter }) {
  const { scaling } = encounter
  return (
    <article aria-labelledby="encounter-title" className="space-y-6 font-serif text-body-sm text-foreground">
      <header className="space-y-3">
        <h2 id="encounter-title" className="font-serif text-h2-sm font-semibold text-balance md:text-h2">
          {encounter.title}
        </h2>
        <p className="text-muted-foreground md:text-body">{withDice(encounter.summary)}</p>
      </header>

      <Section title="Enemies">
        <div className="space-y-6">
          {encounter.enemies.map((enemy, i) => (
            <div key={i} className="space-y-2">
              <p className="font-sans text-ui text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{enemy.count} ×</span>{' '}
                <span className="capitalize">{enemy.role}</span>
              </p>
              <MonsterStatBlock monster={enemy.statBlock} headingLevel={4} />
            </div>
          ))}
        </div>
      </Section>

      {encounter.terrain.length > 0 && (
        <Section title="Terrain">
          <ul className="space-y-3">
            {encounter.terrain.map((t, i) => (
              <li key={i} data-print-keep>
                <strong className="font-semibold">{t.name}.</strong> {withDice(t.rules)}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {encounter.tactics.length > 0 && (
        <Section title="Tactics">
          <Bullets items={encounter.tactics} />
        </Section>
      )}

      {encounter.hooks.length > 0 && (
        <Section title="Hooks">
          <Bullets items={encounter.hooks} />
        </Section>
      )}

      {(scaling.easier.length > 0 || scaling.harder.length > 0) && (
        <Section title="Scaling">
          <div className="grid gap-5 sm:grid-cols-2">
            {scaling.easier.length > 0 && (
              <div className="space-y-2" data-print-keep>
                <h4 className="font-sans text-ui font-semibold">If it runs too hard</h4>
                <Bullets items={scaling.easier} />
              </div>
            )}
            {scaling.harder.length > 0 && (
              <div className="space-y-2" data-print-keep>
                <h4 className="font-sans text-ui font-semibold">If it runs too easy</h4>
                <Bullets items={scaling.harder} />
              </div>
            )}
          </div>
        </Section>
      )}
    </article>
  )
}
