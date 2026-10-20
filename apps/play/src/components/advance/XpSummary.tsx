import type { PurchaseKind } from '@heartrush/rules-engine/types'
import type { Derived } from '~/server/characters'

const KIND_LABEL: Record<PurchaseKind, string> = {
  'talent:combat': 'Combat talents',
  'talent:noncombat': 'Noncombat talents',
  'talent:elemental': 'Elemental talents',
  die: 'Ability dice',
  hp: 'Max HP',
  'aspect:new': 'New aspects',
  'aspect:rank': 'Aspect ranks',
  destiny: 'Destiny levels',
  path: 'Path',
  'path:tier': 'Path tiers',
}

/** Remaining XP large, then awarded and spent, then what the spent XP went on (`xpByKind`, only kinds bought). */
export function XpSummary({ xp }: { xp: Derived['xp'] }) {
  const kinds = Object.entries(xp.byKind) as [PurchaseKind, number][]
  return (
    <section aria-label="Experience" className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <p className="flex items-baseline gap-2">
        <span className="font-serif text-h2-sm font-semibold tabular-nums">{xp.remaining}</span>
        <span className="text-ui text-muted-foreground">XP remaining</span>
      </p>
      <p className="text-ui text-muted-foreground tabular-nums">
        {xp.awarded} awarded · {xp.spent} spent
      </p>
      {kinds.length > 0 && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 text-ui tabular-nums">
          {kinds.map(([kind, sum]) => (
            <div key={kind} className="contents">
              <dt className="text-muted-foreground">{KIND_LABEL[kind]}</dt>
              <dd className="text-right">{sum}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
