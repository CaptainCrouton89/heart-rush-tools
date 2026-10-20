import { Fragment, useRef, useState } from 'react'
import { useMatch } from '@tanstack/react-router'
import type { AbilityId, Character } from '@heartrush/rules-engine/types'
import type { Derived } from '~/server/characters'
import { RollPanel } from '../roll/RollPanel'
import { RollResultView, type RollOutcome } from '../roll/RollResult'

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
 *
 * For a viewer who may edit the sheet, the ability name opens the roll panel on that ability (campaign spec §3.2), and the
 * last roll's result stays under its ability's row until the next roll.
 */
export function AbilityRows({ character, derived }: { character: Character; derived: Derived }) {
  // Rolling is offered on the sheet route only; elsewhere (the GM view renders these rows too) the names stay plain labels.
  const sheet = useMatch({ from: '/characters/$id', shouldThrow: false })?.loaderData
  const characterId = sheet?.id ?? null
  const canRoll = sheet !== undefined && (sheet.role === 'owner' || sheet.role === 'gm')
  const [open, setOpen] = useState<AbilityId | null>(null)
  const [last, setLast] = useState<{ ability: AbilityId; outcome: RollOutcome } | null>(null)
  const anchor = useRef<HTMLElement | null>(null)
  // A different character (route param change) does not inherit the last result.
  const shown = last && last.outcome.characterId === characterId ? last : null

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
            // While the panel is open it shows the result itself, so its choices are never offered in two places.
            const result = open === null && shown?.ability === id ? shown.outcome : null
            return (
              <Fragment key={id}>
              <tr className="h-11 border-b border-border">
                <th scope="row" className="pr-2 text-left text-meta font-semibold tracking-wide text-muted-foreground uppercase">
                  {canRoll ? (
                    <button
                      type="button"
                      className="-ml-1 inline-flex min-h-11 min-w-11 items-center rounded-sm px-1 text-left uppercase underline decoration-dotted underline-offset-4 hover:text-foreground"
                      aria-label={`Roll ${label}`}
                      aria-haspopup="dialog"
                      onClick={(e) => {
                        anchor.current = e.currentTarget
                        setOpen(id)
                      }}
                    >
                      {label}
                    </button>
                  ) : (
                    label
                  )}
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
              {result && (
                <tr className="border-b border-border">
                  <td colSpan={5} className="font-normal normal-case">
                    <RollResultView compact outcome={result} onChange={(outcome) => setLast({ ability: id, outcome })} />
                  </td>
                </tr>
              )}
              </Fragment>
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
      {open && characterId !== null && (
        <RollPanel
          key={open}
          character={{ id: characterId, name: character.identity.name, state: character }}
          ability={open}
          anchor={anchor}
          onClose={() => setOpen(null)}
          onResult={(outcome) => setLast({ ability: outcome.view.ability, outcome })}
        />
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
