// Test helpers: a minimal valid Character and a condition catalogue shaped like the real compiler output.
import { indexById, type PlayCondition, type ConditionCatalogue } from '../src/catalogue'
import type { Character, Condition, Weapon } from '../src/types'

export function makeCharacter(over: Partial<Character> = {}): Character {
  return {
    schemaVersion: 1,
    draft: false,
    identity: { name: 'Test', pronouns: '', dream: '', description: '', motivation: '', portrait: null, ageCategory: 'adult', ageBenefits: [] },
    kin: { raceId: 'player.kin-culture.centaur', subraceId: null, titleSnapshot: 'Centaur', spelltouched: false, choices: {} },
    attunements: [],
    path: null,
    bloodmarks: { level: 0, abilities: [] },
    abilities: {
      might: { start: 6, current: 6 },
      agility: { start: 4, current: 4 },
      cunning: { start: 6, current: 6 },
      presence: { start: 4, current: 4 },
    },
    hp: { baseMax: 40, current: 40, heartDieCurrent: 8 },
    wounds: [],
    conditions: [],
    aspects: [],
    professions: [],
    talents: [],
    gear: {
      weapons: [],
      armor: { name: '', weight: 'none', misc: 0, worn: false },
      shield: { name: '', weight: 'none', misc: 0, worn: false },
      items: [],
      coins: { iron: 0, obol: 0, lire: 0, ducat: 0, crown: 0 },
    },
    xp: { awarded: 0, purchases: [] },
    play: { round: 1, rushPoints: 0, dp: 3, baseSpeed: 60, staminaSpentRound: null, failedRestStreak: 0, dpPerComplication: 1, professionChallengeDelta: 0 },
    raceEffects: [],
    notes: '',
    ...over,
  }
}

export function weapon(over: Partial<Weapon> = {}): Weapon {
  return { id: 'w1', name: 'Weapon', size: 'L', damageType: 'S', attackType: 'melee', reach: false, misc: 0, wielded: true, ...over }
}

let n = 0
export function condition(conditionId: string, level: number | null = 1, over: Partial<Condition> = {}): Condition {
  return { id: `c${n++}`, conditionId, name: null, level, permanent: false, source: 'manual', affects: [], ...over }
}

const entry = (anchor: string, title: string, over: Partial<PlayCondition>): PlayCondition => ({
  id: `player.conditions~${anchor}`, path: `/player/conditions#${anchor}`, title,
  leveled: true, fading: false, ongoing: false, penalizes: null, situational: null, body: '', ...over,
})

/** Mirrors packages/content/dist/catalogues/play/conditions.json for the conditions the engine reasons about. */
export const conditions: ConditionCatalogue = indexById([
  entry('dazed', 'Dazed', { fading: true, penalizes: ['cunning'] }),
  entry('weakened', 'Weakened', { fading: true, penalizes: ['might'] }),
  entry('off-balanced', 'Off-Balanced', { fading: true, penalizes: ['agility'] }),
  entry('shaken', 'Shaken', { fading: true, penalizes: ['presence'] }),
  entry('poisoned', 'Poisoned', { ongoing: true, penalizes: 'all' }),
  entry('restrained', 'Restrained', { ongoing: true, situational: 'You have disadvantage on all A/D rolls and any ability checks requiring motion.' }),
  entry('slowed', 'Slowed', { fading: true }),
  entry('crippled', 'Crippled', { leveled: false, ongoing: true }),
  entry('blinded', 'Blinded', { fading: true, situational: 'You have disadvantage on A/D and ability rolls requiring sight.' }),
  entry('aggravated', 'Aggravated', { ongoing: true, situational: 'You have disadvantage on A/D and ability rolls against any other creature besides the source of your aggravation.' }),
  entry('burning', 'Burning', { fading: true, situational: 'take 1d6 damage for each level of burning' }),
])
