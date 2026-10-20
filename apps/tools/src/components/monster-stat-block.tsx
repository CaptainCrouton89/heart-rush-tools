import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@heartrush/ui/components/button'
import { cn } from '@heartrush/ui/lib/utils'
import type { Component, MonsterStatBlock as Monster } from '~/monster/schema'
import { AbilityText, formatAttackDefense, withDice } from '~/monster/format'
import { generateMarkdown } from '~/monster/markdown'

type Stats = Pick<Monster, 'abilities' | 'heartDie' | 'hp' | 'woundThreshold' | 'attack' | 'defense'>
type HeadingLevel = 2 | 3 | 4

const headingTag = (level: number) => `h${Math.min(level, 6)}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

function Label({ title, children }: { title: string; children: ReactNode }) {
  return (
    <abbr title={title} className="font-semibold no-underline">
      {children}
    </abbr>
  )
}

/**
 * The two stat lines in the printed order of the Monster Creation Guide:
 * `Might/Agility/Cunning/Presence HD … HP … w …`, then `A … D …`.
 */
function StatLines({ m }: { m: Stats }) {
  const { might, agility, cunning, presence } = m.abilities
  return (
    <div className="space-y-1 font-sans text-table tabular-nums">
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <span
          className="dice text-[length:inherit]"
          aria-label={`Might ${might}, Agility ${agility}, Cunning ${cunning}, Presence ${presence}`}
          title="Might / Agility / Cunning / Presence"
        >
          {might}/{agility}/{cunning}/{presence}
        </span>
        <span className="whitespace-nowrap">
          <Label title="Heart die">HD</Label> <span className="dice text-[length:inherit]">{m.heartDie}</span>
        </span>
        <span className="whitespace-nowrap">
          <Label title="Hit points">HP</Label> {m.hp}
        </span>
        <span className="whitespace-nowrap">
          <Label title="Wound threshold">w</Label>{' '}
          {m.woundThreshold === null ? <span aria-label="unwoundable">/</span> : m.woundThreshold}
        </span>
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        {formatAttackDefense(m.attack, 'A')}
        {formatAttackDefense(m.defense, 'D')}
      </p>
    </div>
  )
}

/** "Size L · Speed 60 (burrow) · Cannot be pushed · …" — the line under the name. */
function MetaLine({ size, movement, extra = [] }: { size: string; movement: Monster['movement']; extra?: string[] }) {
  const items = [
    `Size ${size}`,
    movement?.speed ? `Speed ${movement.speed}` : null,
    movement?.special?.length ? movement.special.join(', ') : null,
    movement?.cannotBePushed ? 'Cannot be pushed' : null,
    ...extra,
  ].filter((x): x is string => Boolean(x))
  return (
    <p className="font-sans text-ui text-muted-foreground">
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {item}
        </span>
      ))}
    </p>
  )
}

function AbilityList({ items }: { items: Monster['specialAbilities'] }) {
  if (items.length === 0) return null
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
      {items.map((a, i) => (
        <li key={i}>
          <AbilityText ability={a} />
        </li>
      ))}
    </ul>
  )
}

function Section({ title, level, children }: { title: string; level: number; children: ReactNode }) {
  const H = headingTag(level)
  return (
    <section className="space-y-2">
      <H className="eyebrow">{title}</H>
      {children}
    </section>
  )
}

function ComponentBlock({ c, level }: { c: Component; level: number }) {
  const H = headingTag(level)
  const extra = [c.shared ? 'Shared damage' : null].filter((x): x is string => Boolean(x))
  return (
    <article className="space-y-3 border-t border-border pt-4" data-print-keep>
      <header>
        <H className="font-serif text-h4 font-semibold">
          {c.name}
          {c.quantity && c.quantity > 1 && (
            <span className="ml-2 font-sans text-ui font-normal text-muted-foreground tabular-nums">×{c.quantity}</span>
          )}
        </H>
        {c.subtitle && <p className="font-serif italic text-muted-foreground">{c.subtitle}</p>}
        <MetaLine size={c.size} movement={c.movement} extra={extra} />
      </header>
      <StatLines m={c} />
      <AbilityList items={c.specialAbilities} />
      {c.notes && <p className="text-muted-foreground">{withDice(c.notes)}</p>}
    </article>
  )
}

function CopyMarkdownButton({ monster }: { monster: Monster }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  async function copy() {
    clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(generateMarkdown(monster))
      setState('copied')
    } catch {
      setState('failed')
    }
    timer.current = setTimeout(() => setState('idle'), 2000)
  }
  return (
    <Button variant="outline" size="sm" onClick={() => void copy()} className="print-hidden shrink-0">
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy Markdown'}
      </span>
    </Button>
  )
}

/**
 * One monster laid out as a printed Heart Rush stat block (Monster Creation Guide,
 * "Understanding the Monster Statblock"). Self-contained, so a page can render several:
 * each block owns its copy button and heading ids. `headingLevel` is the level of the
 * monster's name (default h2); its sections and components sit one level below.
 */
export function MonsterStatBlock({
  monster,
  headingLevel = 2,
  className,
}: {
  monster: Monster
  headingLevel?: HeadingLevel
  className?: string
}) {
  const nameId = useId()
  const H = headingTag(headingLevel)
  const sub = headingLevel + 1
  const engagements = monster.mechanics?.engagementsPerRound
  const auras = monster.mechanics?.auras ?? []
  const phases = monster.mechanics?.phases ?? []
  const components = monster.components ?? []
  const extra = engagements && engagements > 1 ? [`Engages ${engagements}× per round`] : []

  return (
    <article
      aria-labelledby={nameId}
      data-print-keep={components.length === 0 ? '' : undefined}
      className={cn(
        'rounded-md border border-border bg-surface px-5 py-5 font-serif text-body-sm text-foreground sm:px-6 print:border-0 print:px-0',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b-2 border-primary pb-3">
        <div className="min-w-0">
          <H id={nameId} className="font-serif text-h3 font-semibold text-balance">
            {monster.name}
          </H>
          {monster.subtitle && <p className="italic text-muted-foreground">{monster.subtitle}</p>}
        </div>
        <CopyMarkdownButton monster={monster} />
      </header>

      <div className="mt-3 space-y-4">
        {components.length === 0 ? (
          <>
            <MetaLine size={monster.size} movement={monster.movement} extra={extra} />
            <div className="border-b border-border pb-3">
              <StatLines m={monster} />
            </div>
            <AbilityList items={monster.specialAbilities} />
          </>
        ) : (
          <MetaLine size={monster.size} movement={monster.movement} extra={extra} />
        )}

        {auras.length > 0 && (
          <Section title="Environmental effects" level={sub}>
            <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
              {auras.map((aura, i) => (
                <li key={i}>
                  <strong className="font-semibold">{aura.name}</strong> ({aura.range}): {withDice(aura.effect)}
                  {aura.save && <span className="whitespace-nowrap">{` (${aura.save.type}${aura.save.dc})`}</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {components.length > 0 && (
          <Section title="Components" level={sub}>
            <div className="space-y-4">
              {components.map((c, i) => (
                <ComponentBlock key={i} c={c} level={sub + 1} />
              ))}
            </div>
          </Section>
        )}

        {phases.length > 0 && (
          <Section title="Phases" level={sub}>
            <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
              {phases.map((p, i) => (
                <li key={i}>
                  <em>{p.trigger}:</em> {withDice(p.changes.join('; '))}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {monster.notes && (
          <aside className="callout" data-kind="note">
            <p className="callout-label">GM notes</p>
            <p>{withDice(monster.notes)}</p>
          </aside>
        )}
      </div>
    </article>
  )
}
