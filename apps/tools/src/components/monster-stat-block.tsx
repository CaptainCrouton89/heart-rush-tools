import { Card, CardContent, CardHeader, CardTitle } from '@heartrush/ui/components/card'
import { Button } from '@heartrush/ui/components/button'
import type { MonsterStatBlock as Monster } from '~/monster/schema'
import { formatAbility, formatAttackDefense } from '~/monster/format'

type Stats = Pick<Monster, 'abilities' | 'heartDie' | 'hp' | 'woundThreshold' | 'attack' | 'defense'>

function StatLine({ m }: { m: Stats }) {
  const { might, agility, cunning, presence } = m.abilities
  return (
    <div className="rounded bg-muted p-2 font-mono text-xs">
      {might}/{agility}/{cunning}/{presence} <strong>HD</strong> {m.heartDie} <strong>HP</strong> {m.hp}{' '}
      <strong>w</strong> {m.woundThreshold === null ? '/' : m.woundThreshold}
      <br />
      {formatAttackDefense(m.attack, 'A')} {formatAttackDefense(m.defense, 'D')}
    </div>
  )
}

function Abilities({ items, title }: { items: Monster['specialAbilities']; title: string }) {
  if (items.length === 0) return null
  return (
    <section>
      <h4 className="mb-1 font-semibold">{title}</h4>
      <ul className="list-inside list-disc space-y-1">
        {items.map((a, i) => (
          <li key={i}>{formatAbility(a)}</li>
        ))}
      </ul>
    </section>
  )
}

export function MonsterStatBlock({ monster, copied, onCopy }: { monster: Monster; copied: boolean; onCopy: () => void }) {
  const engagements = monster.mechanics?.engagementsPerRound
  const auras = monster.mechanics?.auras ?? []
  const phases = monster.mechanics?.phases ?? []
  const movement = monster.movement
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-xl">Generated Monster</CardTitle>
        <Button variant="secondary" size="sm" onClick={onCopy} aria-label="Copy monster stat block as markdown text">
          {copied ? 'Copied!' : 'Copy Markdown'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <header>
          <h3 className="text-2xl font-bold">{monster.name}</h3>
          {monster.subtitle && <p className="italic text-muted-foreground">{monster.subtitle}</p>}
          <p className="text-muted-foreground">
            <strong>Size:</strong> {monster.size}
          </p>
        </header>

        {monster.notes && (
          <aside className="rounded-md bg-muted/40 p-3">
            <strong>Notes:</strong> {monster.notes}
          </aside>
        )}

        {engagements && engagements > 1 && (
          <aside className="rounded-md bg-muted/40 p-2">
            <strong>Engagements:</strong> {engagements}x per round
          </aside>
        )}

        {auras.length > 0 && (
          <aside className="rounded-md bg-muted/40 p-3">
            <h4 className="font-bold">Environmental Effects:</h4>
            <ul className="mt-1 list-inside list-disc space-y-1">
              {auras.map((aura, i) => (
                <li key={i}>
                  <strong>{aura.name}</strong> ({aura.range}): {aura.effect}
                </li>
              ))}
            </ul>
          </aside>
        )}

        {monster.components && monster.components.length > 0 ? (
          <section>
            <h4 className="mb-3 font-semibold">Components</h4>
            {monster.components.map((c, i) => (
              <article key={i} className="mb-4 space-y-2 rounded-md border p-3">
                <h5 className="text-base font-semibold">
                  {c.name}
                  {c.quantity && c.quantity > 1 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">(x{c.quantity})</span>
                  )}
                </h5>
                <p>
                  <strong>Size:</strong> {c.size}
                  {c.movement?.cannotBePushed && <span className="ml-2 text-muted-foreground">• Cannot be Pushed</span>}
                </p>
                <StatLine m={c} />
                <Abilities items={c.specialAbilities} title="Abilities:" />
              </article>
            ))}
          </section>
        ) : (
          <section className="space-y-3">
            <StatLine m={monster} />
            <Abilities items={monster.specialAbilities} title="Special Abilities" />
            {movement && (
              <p>
                <strong>Movement:</strong>
                {movement.cannotBePushed && ' Cannot be Pushed'}
                {movement.speed && ` Speed ${movement.speed}`}
                {movement.special && ` (${movement.special.join(', ')})`}
              </p>
            )}
            {phases.length > 0 && (
              <div>
                <h4 className="font-bold">Phases:</h4>
                <ul className="mt-1 list-inside list-disc">
                  {phases.map((p, i) => (
                    <li key={i}>
                      <em>{p.trigger}:</em> {p.changes.join('; ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </CardContent>
    </Card>
  )
}
