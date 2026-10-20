import type { AbilityId, Character } from '@heartrush/rules-engine/types'
import type { Derived } from '~/server/characters'

const ROWS: { id: AbilityId; label: string }[] = [
  { id: 'might', label: 'Might' },
  { id: 'agility', label: 'Agility' },
  { id: 'cunning', label: 'Cunning' },
  { id: 'presence', label: 'Presence' },
]

/** Might, Agility and Cunning are stances: each has weapon dice and the defense bonus. Presence has neither. */
const isStance = (id: AbilityId): id is 'might' | 'agility' | 'cunning' => id !== 'presence'

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)

/**
 * One row per ability: its die, the wielded weapon's dice in that stance, the defense bonus and the levels of
 * disadvantage from conditions ("D2"), then one line per condition whose penalty depends on the situation. Every
 * number comes from the hook's `derived` (INV-DERIVED); "—" is "none".
 */
export function AbilityRows({ character, derived }: { character: Character; derived: Derived }) {
  return (
    <section aria-label="Abilities and defense" className="flex flex-col">
      <table className="w-full border-collapse font-sans text-control tabular-nums">
        <thead className="sr-only">
          <tr>
            <th scope="col">Ability</th>
            <th scope="col">Die</th>
            <th scope="col">Weapon dice</th>
            <th scope="col">Defense</th>
            <th scope="col">Disadvantage</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ id, label }) => {
            const dis = derived.disadvantage[id]
            const weapon = isStance(id) ? derived.weaponDice[id] : null
            return (
              <tr key={id} className="h-11 border-b border-border">
                <th scope="row" className="pr-2 text-left text-meta font-semibold tracking-wide text-muted-foreground uppercase">
                  {label}
                </th>
                <td className="px-2 font-semibold">
                  <span className="dice">d{character.abilities[id].current}</span>
                </td>
                <td className="px-2">{weapon ? <span className="dice">{weapon}</span> : <None />}</td>
                <td className="px-2">{isStance(id) ? <span aria-label={`defense ${signed(derived.defenseBonus)}`}>def {signed(derived.defenseBonus)}</span> : <None />}</td>
                <td className="pl-2 text-right">
                  {dis > 0 ? (
                    <span className="font-semibold text-primary" aria-label={`disadvantage ${dis}`}>
                      D{dis}
                    </span>
                  ) : (
                    <None />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {derived.situational.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {derived.situational.map((s) => (
            <li key={s.conditionId} className="text-ui text-muted-foreground">
              <span className="font-medium text-foreground">
                {s.title}
                {s.level > 1 && ` ${s.level}`}:
              </span>{' '}
              {s.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function None() {
  return (
    <span className="text-muted-foreground" aria-label="none">
      —
    </span>
  )
}

/** Speed, DP and gear slots, under the ability rows. */
export function SpeedLine({ character, derived }: { character: Character; derived: Derived }) {
  const over = derived.slotsUsed > derived.slotCapacity
  return (
    <p className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-control tabular-nums">
      <span>
        <span className="text-muted-foreground">Speed</span> {derived.speed} ft
      </span>
      <span>
        <span className="text-muted-foreground">DP</span> {character.play.dp}
      </span>
      <span className={over ? 'text-primary' : undefined}>
        <span className="text-muted-foreground">Slots</span> {derived.slotsUsed} / {derived.slotCapacity}
      </span>
    </p>
  )
}
