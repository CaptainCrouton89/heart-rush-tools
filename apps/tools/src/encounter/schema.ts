import { z } from 'zod'
import { generatedMonsterSchema } from '~/monster/schema'

export const roleSchema = z.enum(['minion', 'standard', 'elite', 'boss', 'legendary'])
export type Role = z.infer<typeof roleSchema>

export const questionSchema = z.object({
  id: z.string().describe('Short stable id, e.g. "q1"'),
  text: z.string().describe('The question, in one or two plain sentences'),
  suggestions: z
    .array(z.string())
    .min(2)
    .max(3)
    .describe(
      'Two or three genuinely different, viable answers. Each changes the fight; none is obviously right. The app adds "You decide" itself — never include it.',
    ),
})

export const outlineSchema = z.object({
  enemies: z
    .array(
      z.object({
        name: z.string(),
        role: roleSchema,
        count: z.number().int().min(1),
        concept: z.string().describe('One line: what this enemy does that makes the fight interesting'),
      }),
    )
    .min(1),
  terrain: z.array(z.string()).describe('Terrain features, one short line each'),
  difficulty: z.string().describe('One line: how dangerous this is for the party and why'),
})

export const encounterSchema = z.object({
  title: z.string(),
  summary: z
    .string()
    .describe('One paragraph: what was built and why it fits the party. On a revision, say what changed.'),
  enemies: z
    .array(
      z.object({
        count: z.number().int().min(1),
        role: roleSchema,
        statBlock: generatedMonsterSchema,
      }),
    )
    .min(1),
  terrain: z.array(z.object({ name: z.string(), rules: z.string().describe('The rules text, with numbers') })),
  tactics: z.array(z.string()).describe('Non-obvious enemy behaviour only. Usually an empty list.'),
  hooks: z
    .array(z.string())
    .describe('What the enemies might want, as possibilities for the GM to pick from. Never a stated motive.'),
  scaling: z.object({
    easier: z.array(z.string()).describe('Concrete levers for when the fight runs too hard'),
    harder: z.array(z.string()).describe('Concrete levers for when the fight runs too easy'),
  }),
})

const questionsStep = z.object({ kind: z.literal('questions'), questions: z.array(questionSchema).min(1).max(4) })
const outlineStep = z.object({
  kind: z.literal('outline'),
  outline: outlineSchema,
  suggestions: z.array(z.string()).min(1).max(4).describe('Quick replies. The first is "Build it".'),
})
const encounterStep = z.object({
  kind: z.literal('encounter'),
  encounter: encounterSchema,
  suggestions: z.array(z.string()).max(3).describe('Optional quick tweak replies, e.g. "Make the boss nastier"'),
})

/** What one run settles with. The union sits under `step` because some providers reject a union at the schema root. */
export const turnSchema = z.object({
  message: z.string().describe("The agent's chat text for this turn"),
  step: z.discriminatedUnion('kind', [questionsStep, outlineStep, encounterStep]),
})

export const partySchema = z.object({
  characters: z.number().int().min(1).max(10),
  bloodmarks: z.number().int().min(0).max(50),
  note: z.string().max(500),
})

export type Question = z.infer<typeof questionSchema>
export type Outline = z.infer<typeof outlineSchema>
export type Encounter = z.infer<typeof encounterSchema>
export type Turn = z.infer<typeof turnSchema>
export type Party = z.infer<typeof partySchema>
export const DEFAULT_PARTY: Party = { characters: 4, bloodmarks: 0, note: '' }

/** The step as stored on an agent message. An `encounter` step keeps only its quick replies: the encounter itself is the encounter's `document`. */
export type StoredStep =
  | { kind: 'questions'; questions: Question[] }
  | { kind: 'outline'; outline: Outline; suggestions: string[] }
  | { kind: 'encounter'; suggestions: string[] }

/** One entry of an encounter's `messages`. */
export type StoredMessage = { role: 'gm'; text: string; at: string } | { role: 'agent'; text: string; step: StoredStep; at: string }
