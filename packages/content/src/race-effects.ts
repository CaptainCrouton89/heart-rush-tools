// Hand-maintained, typed race effects for the play site. Keep in step with heart_rush/races/*.md:
// the compiler reports any race in this map whose file no longer exists, and every race not listed here
// gets an empty list ("no racial effects" on the sheet). Anything the kinds cannot express is `manual`.
import type { RaceEffect } from './types.ts'

const talentAll = (delta: number, where: { tradition: string }): RaceEffect[] =>
  (['talent:combat', 'talent:noncombat', 'talent:elemental'] as const).map((purchase) => ({ kind: 'cost', purchase, delta, where }))

// Keyed by race file stem.
export const RACE_EFFECTS: Record<string, RaceEffect[]> = {
  Craven: [{ kind: 'awardBonus', per: 7, bonus: 1 }],
  Dwarf: [{ kind: 'cost', purchase: 'hp', delta: -1 }],
  Elf: [
    { kind: 'cost', purchase: 'aspect:rank', delta: -2 },
    { kind: 'aspectRankCap', max: 8 },
    { kind: 'manual', text: 'Gaining or upgrading aspects costs 2 less XP, for a minimum of 1.' },
  ],
  Gnome: [
    ...talentAll(-2, { tradition: 'Handmagic' }),
    { kind: 'cost', purchase: 'destiny', delta: -2, where: { tradition: 'Handmagic' } },
    { kind: 'cost', purchase: 'hp', delta: 1 },
    { kind: 'manual', text: 'Whiteling (Oracle\'s Burden): maximum hit points start at 25, increasing them costs 1 additional XP, and your might die can never exceed d6.' },
  ],
  Deva: [{ kind: 'cost', purchase: 'die', delta: -2, where: { ability: 'presence' } }],
  Ghoul: [{ kind: 'manual', text: 'Oath talents and their destiny levels cost 2 XP less.' }],
  Mira: [{ kind: 'manual', text: 'Female: elemental talents cost 2 less XP.' }],
  Trollkin: [{ kind: 'cost', purchase: 'hp', delta: -2 }],
  Human: [{ kind: 'manual', text: 'Shontobi (Honor Bound): upgrading honor-related aspects costs 1 less XP.' }],
}
