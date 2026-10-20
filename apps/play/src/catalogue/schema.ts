// zod schemas for the play catalogue files emitted by packages/content
// (packages/content/dist/catalogues/play/{talents,races,conditions}.json). They follow the contract shape
// in the kin-choices contract and must stay assignable to the engine's types in
// packages/rules-engine/src/catalogue.ts; the assertions at the bottom fail `tsc` if they drift apart.
import { z } from 'zod'
import type {
  PlayAbility,
  PlayChoice,
  PlayCondition,
  PlayRace,
  PlayTalent,
  RaceEffect,
} from '@heartrush/rules-engine/catalogue'

export const SCHEMA_VERSION = 1

const tradition = z.enum(['Martial', 'Cognitive', 'Handmagic', 'Gaeic melody'])
const frequency = z.enum(['passive', 'minor', 'major', 'weekly', 'monthly'])
const abilityId = z.enum(['might', 'agility', 'cunning', 'presence'])
const die = z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12)])
const purchase = z.enum([
  'aspect:new', 'aspect:rank', 'hp', 'die',
  'talent:combat', 'talent:noncombat', 'talent:elemental', 'talent:*',
  'destiny', 'path', 'path:tier',
])

export const raceEffectSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('cost'),
    purchase,
    delta: z.number(),
    where: z.object({ tradition: tradition.optional(), honor: z.literal(true).optional(), ability: abilityId.optional() }).optional(),
  }),
  z.object({ kind: z.literal('dieCap'), ability: abilityId, max: die }),
  z.object({ kind: z.literal('aspectRankCap'), max: z.number() }),
  z.object({ kind: z.literal('awardBonus'), per: z.number(), bonus: z.number() }),
  z.object({ kind: z.literal('attunement'), elements: z.tuple([z.string()]), level: z.literal('basic') }),
  z.object({ kind: z.literal('manual'), text: z.string() }),
])

const abilitySchema = z.object({
  title: z.string(),
  frequency: frequency.nullable(),
  body: z.string(),
  grants: z.object({ talentId: z.string(), destiny: z.boolean() }).nullable(),
})

const choiceSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    title: z.string(),
    text: z.string(),
    kind: z.literal('options'),
    options: z.array(z.object({
      id: z.string(),
      title: z.string(),
      abilities: z.array(abilitySchema),
      effects: z.array(raceEffectSchema),
    })),
  }),
  z.object({ id: z.string(), title: z.string(), text: z.string(), kind: z.literal('talent'), tradition: tradition.nullable() }),
])

const subraceSchema = z.object({
  id: z.string(),
  title: z.string(),
  aspects: z.array(z.string()),
  abilities: z.array(abilitySchema),
  choices: z.array(choiceSchema),
  effects: z.array(raceEffectSchema),
  baseMaxHp: z.number().optional(),
})

export const talentSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  category: z.enum(['combat', 'noncombat', 'elemental']),
  frequency: frequency.nullable(),
  tradition: tradition.nullable(),
  elements: z.array(z.string()),
  attunementLevel: z.enum(['basic', 'advanced', 'paragon']).optional(),
  body: z.string(),
  destiny: z.string().nullable(),
})

export const raceSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  size: z.string().nullable(),
  image: z.string().nullable(),
  baseMaxHp: z.number().optional(),
  aspects: z.array(z.string()),
  abilities: z.array(abilitySchema),
  choices: z.array(choiceSchema),
  subraces: z.array(subraceSchema),
  effects: z.array(raceEffectSchema),
})

export const conditionSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  leveled: z.boolean(),
  fading: z.boolean(),
  ongoing: z.boolean(),
  penalizes: z.union([z.array(abilityId), z.literal('all')]).nullable(),
  situational: z.string().nullable(),
  body: z.string(),
})

/** Every play catalogue file is `{schemaVersion, contentVersion, entries}`. */
function fileSchema<T extends z.ZodType>(entry: T) {
  return z.object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    contentVersion: z.string().min(1),
    entries: z.array(entry),
  })
}

export const talentsFileSchema = fileSchema(talentSchema)
export const racesFileSchema = fileSchema(raceSchema)
export const conditionsFileSchema = fileSchema(conditionSchema)

// Compile-time check: each parsed entry is assignable to the engine's type (and the effect, ability and
// choice pieces too, so a drift names the piece that moved).
type Assert<_T extends true> = never
type Fits<Parsed, Engine> = [Parsed] extends [Engine] ? true : false
export type _Checks = [
  Assert<Fits<z.infer<typeof raceEffectSchema>, RaceEffect>>,
  Assert<Fits<z.infer<typeof abilitySchema>, PlayAbility>>,
  Assert<Fits<z.infer<typeof choiceSchema>, PlayChoice>>,
  Assert<Fits<z.infer<typeof talentSchema>, PlayTalent>>,
  Assert<Fits<z.infer<typeof raceSchema>, PlayRace>>,
  Assert<Fits<z.infer<typeof conditionSchema>, PlayCondition>>,
]
