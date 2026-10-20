import { LocalTime } from '~/components/campaign/sessions/LocalTime'
import { DieChip } from '~/components/roll/RollResult'
import type { CampaignDetail } from '~/server/campaigns'
import type { Complication, RollRecord } from '~/server/rolls'

/**
 * The roll feed (spec §3.3), read-only. P2 mounts it twice from one list: in the "Rolls" tab below 1024 px and as the
 * fixed right column from 1024 px. `rolls` is the loader's `listRollsFn().rolls` with every roll received on the live
 * channel since then merged in, newest first, at most 200; this component renders it as given.
 *
 * Each entry: character and player, roll type and ability, the dice (dropped dice struck through, a rerolled die as
 * "1 → n"), the modifier, the total, the complication state, the stratagem objective and its CN when there is one, and
 * the time.
 */
export type RollFeedProps = {
  /** The campaign as the page's loader returned it. */
  campaign: CampaignDetail
  /** Newest first. */
  rolls: RollRecord[]
}

const TYPE: Record<RollRecord['rollType'], string> = { check: 'check', save: 'saving throw', attack: 'attack', defense: 'defense' }
const ABILITY: Record<RollRecord['ability'], string> = { might: 'Might', agility: 'Agility', cunning: 'Cunning', presence: 'Presence' }

/** The complication line, or null when the roll had none. */
const COMPLICATION: Record<Complication, string | null> = {
  none: null,
  pending: 'Kept a 1 — choosing to fail or reroll',
  failed: 'Failed (chose to fail on the 1)',
  rerolled: 'Rerolled the 1 — took a complication',
  double: 'Automatic failure plus a complication (two kept 1s)',
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)

export function RollFeed({ rolls }: RollFeedProps) {
  return (
    <section className="flex flex-col gap-2" aria-labelledby="roll-feed-title">
      <h2 id="roll-feed-title" className="eyebrow border-b border-border pb-2">
        Rolls
      </h2>
      {rolls.length === 0 ? (
        <p className="text-ui text-muted-foreground">No rolls yet. Rolls made on a character sheet in this campaign show here.</p>
      ) : (
        <ol className="flex flex-col" aria-label="Rolls, newest first">
          {rolls.map((r) => (
            <li key={r.id}>
              <RollEntry roll={r} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function RollEntry({ roll: r }: { roll: RollRecord }) {
  const complication = COMPLICATION[r.complication]
  // The dice total plus the modifier is the stored total less any flat bonus (a defense's defense bonus, a weapon's +n).
  const kept = r.dice.filter((d) => !d.dropped).reduce((sum, d) => sum + d.value, 0)
  const flat = r.total - kept - r.modifier
  const failed = r.complication === 'failed' || r.complication === 'double'
  return (
    <article className="flex flex-col gap-1.5 border-b border-border py-3 last:border-b-0">
      <header className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-ui">
          <span className="font-semibold">{r.characterName || 'Unnamed character'}</span>
          <span className="text-muted-foreground"> · {r.playerName}</span>
        </p>
        <LocalTime iso={r.createdAt} className="shrink-0 text-meta text-muted-foreground tabular-nums" />
      </header>
      <p className="text-ui">
        {ABILITY[r.ability]} {TYPE[r.rollType]}
      </p>
      {r.objective && (
        <p className="text-ui text-muted-foreground">
          {r.objective.label ?? 'A stratagem objective'} (CN {r.objective.cn})
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-sans text-h4 font-semibold tabular-nums" aria-label={`Total ${r.total}`}>
          {r.total}
        </span>
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Dice">
          {r.dice.map((d, i) => (
            <li key={i}>
              <DieChip die={d} />
            </li>
          ))}
          {flat !== 0 && <li className="text-ui text-muted-foreground tabular-nums">{signed(flat)}</li>}
          {r.modifier !== 0 && (
            <li className="text-ui text-muted-foreground tabular-nums" aria-label={`Modifier ${signed(r.modifier)}`}>
              {signed(r.modifier)}
            </li>
          )}
        </ul>
      </div>
      {complication && <p className={failed ? 'text-ui font-semibold text-primary' : 'text-ui font-semibold'}>{complication}</p>}
      {r.objective && !failed && r.complication !== 'pending' && (
        <p className="text-ui font-semibold">{r.total >= r.objective.cn ? `meets CN ${r.objective.cn}` : `below CN ${r.objective.cn}`}</p>
      )}
    </article>
  )
}
