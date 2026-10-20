// Typed effects and creation-time choices for play, keyed by race file stem and optionally by subrace heading id.
// Rules source: heart_rush/races/*.md. Anything these kinds cannot express stays `manual`; a choice the race text
// requires at creation is a `choice`, and only the selected option's abilities and effects apply (kin-choices-contract).
import type { RaceEffect } from './types.ts'

/** `abilities` are titles of abilities in the same race or subrace; they move out of its `abilities` into this option. */
export type OptionSpec = { id: string; title: string; abilities?: string[]; effects?: RaceEffect[] }
export type ChoiceSpec =
  | { id: string; title: string; text: string; kind: 'options'; options: OptionSpec[] }
  | { id: string; title: string; text: string; kind: 'talent'; tradition: 'Martial' | 'Cognitive' | 'Handmagic' | 'Gaeic melody' | null }
type Entry = { effects?: RaceEffect[]; baseMaxHp?: number; choices?: ChoiceSpec[] }
type Config = Entry & { subraces?: Record<string, Entry> }

const traditionCosts = (tradition: 'Martial' | 'Cognitive'): RaceEffect[] => [
  { kind: 'cost', purchase: 'talent:*', delta: -2, where: { tradition } },
  { kind: 'cost', purchase: 'destiny', delta: -2, where: { tradition } },
]

const attune = (element: string, level: 'basic' | 'advanced' | 'paragon' = 'basic'): RaceEffect => ({ kind: 'attunement', elements: [element], level })

export const RACE_EFFECTS: Record<string, Config> = {
  Craven: { effects: [{ kind: 'awardBonus', per: 7, bonus: 1 }] },
  Dwarf: {
    effects: [{ kind: 'cost', purchase: 'hp', delta: -1 }],
    subraces: {
      'uline-chain-dwarf': {
        choices: [{
          id: 'element', title: 'Mountain-born', kind: 'options', text: 'You gain your choice of a basic attunement to earth or darkness.',
          options: [
            { id: 'earth', title: 'Earth', effects: [attune('earth')] },
            { id: 'dark', title: 'Darkness', effects: [attune('dark')] },
          ],
        }],
      },
      verucan: { effects: [attune('fire')] },
      'yorinthian-winter-dwarves': { effects: [attune('ice')] },
      'nydor-dark-dwarves': { effects: [attune('dark')] },
    },
  },
  'Fallen_Angels': {
    subraces: {
      'sarakiel-light-fallen': { effects: [attune('light')] },
      'xaphkiel-shadow-fallen': { effects: [attune('dark')] },
    },
  },
  Goblin: {
    subraces: {
      darkling: { effects: [attune('dark', 'advanced')] },
      stravlar: { effects: [attune('fire')] },
    },
  },
  Rhea: { effects: [attune('air', 'advanced')] },
  Triton: { effects: [attune('water')] },
  Yngli: { effects: [attune('force', 'paragon')] },
  Elf: {
    effects: [
      { kind: 'cost', purchase: 'aspect:rank', delta: -2 },
      { kind: 'aspectRankCap', max: 8 },
    ],
    subraces: {
      'eloweir-sea-elf': { effects: [attune('water', 'advanced')] },
      'kryaaji-sun-elf': { effects: [attune('light')] },
      'xicrein-island-elf': { effects: [attune('water'), attune('dark')] },
      'spindral-quill-elf': { effects: [attune('void')] },
      'amverela-high-elf': {
        choices: [{
          id: 'expertise', title: 'Expertise', kind: 'options', text: 'Choose one:',
          options: [
            { id: 'martial', title: 'Martial talents', effects: traditionCosts('Martial') },
            { id: 'cognitive', title: 'Cognitive talents', effects: traditionCosts('Cognitive') },
          ],
        }],
      },
    },
  },
  Elnir: {
    choices: [{
      id: 'augmentation', title: 'Biological Augmentation', kind: 'options', text: 'Choose one augmentation at character creation:',
      options: [
        { id: 'venomous', title: 'Venomous' },
        { id: 'wall-climber', title: 'Wall-Climber' },
        { id: 'armored-hide', title: 'Armored Hide' },
        { id: 'enhanced-senses', title: 'Enhanced Senses' },
      ],
    }],
  },
  Gnome: {
    effects: [
      { kind: 'cost', purchase: 'talent:*', delta: -2, where: { tradition: 'Handmagic' } },
      { kind: 'cost', purchase: 'destiny', delta: -2, where: { tradition: 'Handmagic' } },
      { kind: 'cost', purchase: 'hp', delta: 1 },
    ],
    subraces: {
      'neka-wild-gnomes': { effects: [attune('fire')] },
      'whiteling-prophet-gnome': {
        baseMaxHp: 30,
        effects: [
          { kind: 'cost', purchase: 'hp', delta: 1 },
          { kind: 'dieCap', ability: 'might', max: 6 },
        ],
      },
    },
  },
  Deva: { effects: [{ kind: 'cost', purchase: 'die', delta: -2, where: { ability: 'presence' } }] },
  Ghoul: { effects: [{ kind: 'manual', text: 'Oath talents and their destiny levels cost 2 XP less.' }] },
  Mira: {
    choices: [{
      id: 'caste', title: 'Caste', kind: 'options', text: 'Choose your caste at character creation:',
      options: [
        { id: 'male', title: 'Male' },
        { id: 'female', title: 'Female', effects: [{ kind: 'cost', purchase: 'talent:elemental', delta: -2 }] },
        { id: 'common', title: 'Common' },
      ],
    }],
  },
  Trollkin: { effects: [{ kind: 'cost', purchase: 'hp', delta: -2 }] },
  Human: {
    choices: [{ id: 'resilience-talent', title: 'Human Resilience and Diversity', kind: 'talent', tradition: null, text: 'When you gain this ability, choose one talent.' }],
    subraces: {
      husakas: {
        choices: [{ id: 'dust-talent', title: 'Dust Dependency', kind: 'talent', tradition: 'Handmagic', text: 'Choose any handmagic talent.' }],
      },
      shontobi: {
        choices: [{
          id: 'path', title: 'Eagle Companion or Honor Bound', kind: 'options', text: 'Choose One:',
          options: [
            { id: 'eagle-companion', title: 'Eagle Companion', abilities: ['Eagle Companion'] },
            { id: 'honor-bound', title: 'Honor Bound', abilities: ['Honor Bound'], effects: [{ kind: 'cost', purchase: 'aspect:rank', delta: -1, where: { honor: true } }] },
          ],
        }],
      },
      nuun: {
        choices: [{
          id: 'element', title: 'Elemental Heritage', kind: 'options', text: 'Choose fire or water.',
          options: [
            { id: 'fire', title: 'Fire', effects: [attune('fire')] },
            { id: 'water', title: 'Water', effects: [attune('water')] },
          ],
        }],
      },
    },
  },
}
