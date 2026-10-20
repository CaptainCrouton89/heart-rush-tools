// The creation assistant's turn schema and the shapes the server stores for a chat (builder_chat.messages, last_error).
// Pure: zod and types only. The `.describe` texts are read by the model; wording follows the design's turn table.
// What a line means (checking it against a draft, applying it) is `card.ts`; the prompt text is `server/assistant-prompt.ts`.
import { z } from 'zod'

/** The longest player message, the same limit as the other AI questions (`MAX_QUESTION_LENGTH` in server/ai.ts). */
export const MAX_MESSAGE_LENGTH = 2000

const reason = z
  .string()
  .describe(
    'One short line saying why this change is proposed. When the reason is something the player said, quote their words. Plain words, no rules numbers you did not read in the catalogue.',
  )

const text = (what: string) => z.string().describe(what)

// ---- Card lines: one change each, typed against the field or action it writes ---------------------

const nameLine = z.object({ kind: z.literal('name'), text: text('The character name, exactly as the player wrote or chose it.'), reason })
const pronounsLine = z.object({ kind: z.literal('pronouns'), text: text('The pronouns, as the player wrote or chose them.'), reason })
const dreamLine = z.object({ kind: z.literal('dream'), text: text('The dream: hard, self-chosen, and the reason the character goes adventuring. The player\'s own wording.'), reason })

const kinLine = z.object({
  kind: z.literal('kin'),
  raceId: text('The race id, copied exactly from the catalogue.'),
  subraceId: z.string().nullable().describe('The subrace id copied exactly from the catalogue, or null when the race has no subraces or the player has not chosen one yet.'),
  reason,
})
const kinChoiceLine = z.object({
  kind: z.literal('kinChoice'),
  choiceId: text('The id of a creation-time choice on the chosen race or subrace, copied exactly from the catalogue.'),
  optionId: text('The option id the player picks, or for a talent choice the catalogue talent id, copied exactly from the catalogue.'),
  reason,
})

const dieLine = z.object({
  kind: z.literal('die'),
  ability: z.enum(['might', 'agility', 'cunning', 'presence']).describe('The ability whose die is set.'),
  die: z.literal([4, 6]).describe('4 or 6. A character has exactly two d6 and two d4 across the four abilities.'),
  reason,
})
const ageLine = z.object({
  kind: z.literal('age'),
  ageCategory: z.enum(['young', 'adult', 'elderly']).describe('The age category.'),
  ageBenefits: z.array(z.string()).describe('Benefit ids from the age category list: two for young, none for adult, one for elderly.'),
  deepKnowledgeAspect: z.string().nullable().describe('The Deep Knowledge aspect text when the benefit Deep Knowledge is chosen, otherwise null.'),
  ageBenefitProfession: z.string().nullable().describe('The starting profession Wisdom of Experience applies to when that benefit is chosen, otherwise null.'),
  reason,
})
const bloodmarkLevelLine = z.object({
  kind: z.literal('bloodmarkLevel'),
  level: z.number().int().min(0).describe('The starting bloodmark level. 0 unless the player says their table agreed another.'),
  reason,
})
const professionsLine = z.object({
  kind: z.literal('professions'),
  professions: z
    .array(z.object({ name: text('The profession name.'), rank: z.number().int().min(1).describe('Its starting rank.') }))
    .describe('The whole list of starting professions. Ranks must add up to the age category\'s total, so one line holds the set.'),
  reason,
})
const aspectLine = z.object({
  kind: z.literal('aspect'),
  slot: z.literal([1, 2]).describe('Which of the two created aspects: 1 or 2.'),
  text: text('The aspect text. Double-edged: it can help and it can cause trouble.'),
  reason,
})

const talentLine = z.object({
  kind: z.literal('talent'),
  catalogueId: text('The talent id, copied exactly from the catalogue.'),
  attunementElement: z.string().nullable().describe('Only for Elemental Affinity: the element to attune. Otherwise null.'),
  reason,
})
const weaponLine = z.object({
  kind: z.literal('weapon'),
  name: text('The weapon name.'),
  size: z.enum(['H', 'L', 'UL']).describe('Weapon size from the Weapons, Cantrips & Armor page: H heavy, L light, UL ultralight.'),
  damageType: z.enum(['B', 'S', 'P']).describe('B bludgeoning, S slashing, P piercing.'),
  attackType: z.enum(['melee', 'ranged', 'thrown', 'whip']).describe('How it attacks.'),
  reach: z.boolean().describe('Whether it has the reach property.'),
  wielded: z.boolean().describe('Whether it is the wielded weapon. Only one weapon is wielded.'),
  reason,
})
const armorLine = z.object({
  kind: z.literal('armor'),
  name: text('The armor name.'),
  weight: z.enum(['H', 'M', 'L', 'none']).describe('Armor weight from the Weapons, Cantrips & Armor page.'),
  reason,
})
const shieldLine = z.object({
  kind: z.literal('shield'),
  name: text('The shield name.'),
  weight: z.enum(['H', 'L', 'none']).describe('Shield weight from the Weapons, Cantrips & Armor page.'),
  reason,
})
const itemLine = z.object({
  kind: z.literal('item'),
  name: text('The item name.'),
  slots: z.number().min(0).describe('Carrying slots one of it takes, from the Equipment & Gear page.'),
  quantity: z.number().int().min(1).describe('How many.'),
  notes: text('A short note, or an empty string.'),
  reason,
})

export const lineSchema = z.discriminatedUnion('kind', [
  nameLine, pronounsLine, dreamLine, kinLine, kinChoiceLine, dieLine, ageLine, bloodmarkLevelLine, professionsLine, aspectLine,
  talentLine, weaponLine, armorLine, shieldLine, itemLine,
])

// ---- The turn ---------------------------------------------------------------------------------------

const optionRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('race'), raceId: text('The race id, copied exactly from the catalogue.'), subraceId: z.string().nullable().describe('The subrace id from the catalogue, or null.') }),
  z.object({ kind: z.literal('talent'), catalogueId: text('The talent id, copied exactly from the catalogue.') }),
])

const option = z.object({
  label: z.string().max(60).describe('What tapping this option sends, worded as the player would say it, for example "A Fieri halfling". At most 60 characters.'),
  feel: text('One sentence on what playing this would feel like at the table.'),
  link: text('The web: URL of the rules page or entry for this option, taken from a rules search result. Must start with https://rules.heartrush.party/.'),
  ref: optionRef.nullable().describe('When the option is a catalogue race, subrace or talent, which one, with ids copied exactly from the catalogue. Null otherwise.'),
})

const decision = z.object({
  question: text('The one decision this turn asks the player to make, as one plain sentence.'),
  options: z.array(option).min(2).max(4).describe('Two to four real, different, legal choices. The app adds a "You decide" button; never include one.'),
  seeAll: z.enum(['kin', 'talents']).nullable().describe('Offer a button that opens the full kin list (builder step 2) or talent list (step 6). Null for none.'),
})

export const turnSchema = z.object({
  message: z
    .string()
    .describe(
      'The chat text. Plain paragraphs, "- " bullets, **bold**, and Markdown links only to https://rules.heartrush.party/… taken from a search result\'s web: line. Speak only to what the player sent.',
    ),
  decision: decision.nullable().describe('The one decision this turn asks the player to make. Null when the turn only answers or only proposes.'),
  card: z
    .object({
      lines: z.array(lineSchema).min(1).max(16).describe('Proposed changes, one per line, in the order they should apply. Each carries a reason.'),
    })
    .nullable()
    .describe('Proposed changes to the character, applied only when the player taps Apply. Null when nothing is proposed.'),
})

// ---- Types -------------------------------------------------------------------------------------------

export type Turn = z.infer<typeof turnSchema>
/** One change on a card, as the run returns it. */
export type CardLine = z.infer<typeof lineSchema>
export type TurnDecision = NonNullable<Turn['decision']>
export type TurnOption = TurnDecision['options'][number]
export type OptionRef = NonNullable<TurnOption['ref']>

/**
 * A card line as stored. `id` is a ULID; for a talent or gear line it is the id of the pending action Apply adds, with `at`
 * the settle time. `before` is the value of the line's field in the stored draft when the card was made (null when empty);
 * absent for talent and gear lines.
 */
/** A JSON value: what `before` holds, so a stored line can cross a server function. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
export type StoredLine = CardLine & { id: string; before?: Json; at?: string }
export type StoredCard = { lines: StoredLine[] }

export type PlayerMessage = { id: string; role: 'player'; text: string; at: string }
export type AssistantMessage = {
  id: string
  role: 'assistant'
  text: string
  /** The decision after settle dropped invalid options; null when none survived or none was asked. */
  decision: TurnDecision | null
  card: StoredCard | null
  at: string
  runId: string
}
export type StoredMessage = PlayerMessage | AssistantMessage

export type ChatErrorReason = 'declined' | 'deadline_exceeded' | 'runtime_error' | 'not_connected' | 'stopped'
/** What `builder_chat.last_error` holds: why the last run gave no turn. */
export type ChatError = { reason: ChatErrorReason }
