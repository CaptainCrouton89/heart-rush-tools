// The builder draft's pure rules: the steps, what each step needs, which steps are open, the sketch character, and the
// preview the engine computes. No React and no server calls, so the browser's builder and the creation assistant's
// server run the same rules on the same draft. `use-draft.tsx` holds the saver and the hook.
import { createCharacter } from '@heartrush/rules-engine/create'
import { applyAction } from '@heartrush/rules-engine/actions'
import { previewDraft } from '@heartrush/rules-engine/draft'
import { RuleError, type AbilityId, type BuilderInput, type Character, type ClientAction, type DraftState, type RuleErrorCode } from '@heartrush/rules-engine/types'
import { getCatalogue } from '~/catalogue'

// ---- Rules the steps share ------------------------------------------------------------------------

export const ABILITIES: { id: AbilityId; label: string }[] = [
  { id: 'might', label: 'Might' },
  { id: 'agility', label: 'Agility' },
  { id: 'cunning', label: 'Cunning' },
  { id: 'presence', label: 'Presence' },
]

export type Age = BuilderInput['ageCategory']

/** Building_Your_Character.md "Age Categories": profession ranks, the per-profession cap and the benefit picks. */
export const AGE: Record<Age, { label: string; ranks: number; cap: number; picks: number; benefits: { id: string; label: string; text: string }[] }> = {
  young: {
    label: 'Young', ranks: 2, cap: 3, picks: 2,
    benefits: [
      { id: 'natural-learner', label: 'Natural Learner', text: 'Profession advancement requires 1 fewer challenge to complete (minimum 1).' },
      { id: 'fast-healer', label: 'Fast Healer', text: 'Wounds heal at twice the normal rate. A wound that would normally take 4 days to reduce by one rank instead takes 2 days.' },
      { id: 'young-and-foolish', label: 'Young and Foolish', text: 'When you accept a complication or negative aspect invocation, gain 1 extra DP beyond the normal amount.' },
    ],
  },
  adult: { label: 'Adult', ranks: 4, cap: 3, picks: 0, benefits: [] },
  elderly: {
    label: 'Elderly', ranks: 5, cap: 4, picks: 1,
    benefits: [
      { id: 'wisdom-of-experience', label: 'Wisdom of Experience', text: 'Choose one of your starting professions. When making skill checks with this profession, you may reroll any 1s on your dice (this does not trigger complications).' },
      { id: 'deep-knowledge', label: 'Deep Knowledge', text: 'Start with a rank 3 aspect related to accumulated knowledge, such as "Living Encyclopedia of Ancient History" or "Knows Every Herb in the Forest".' },
      { id: 'frail-body-sharp-mind', label: 'Frail Body, Sharp Mind', text: 'Start with the aspect "Frail" at rank 3. It can only be invoked negatively, and gives the normal DP when you do.' },
    ],
  },
}

/** The builder as the draft row holds it before steps 2–5 are filled: what step 1 creates. */
export function newBuilder(id: string, at: string, step1: Pick<BuilderInput, 'name' | 'pronouns' | 'dream' | 'portrait'>): BuilderInput {
  return {
    id, at, ...step1, description: '', motivation: '',
    raceId: '', subraceId: null, kinChoices: {},
    // Partial until step 3 assigns all four (a saved draft may hold an incomplete builder; createCharacter refuses it).
    dice: {} as Record<AbilityId, 4 | 6>,
    ageCategory: 'adult', ageBenefits: [], createdAspects: ['', ''], professions: [], bloodmarkLevel: 0,
  }
}

// ---- Steps --------------------------------------------------------------------------------------

export const STEPS = ['Dream', 'Kin & culture', 'Vitals', 'Professions', 'Aspects', 'Talents', 'Gear'] as const
export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const toStep = (value: unknown): StepNumber => {
  const n = Math.trunc(Number(value))
  return (n >= 1 && n <= STEPS.length ? n : 1) as StepNumber
}

const named = (s: string) => s.trim().toLowerCase()
const count = (n: number) => (n === 1 ? 'one' : n === 2 ? 'two' : String(n))

/** What stops the player leaving `step` with Continue, in plain words. Empty when the step is complete. */
export function stepProblems(step: StepNumber, builder: BuilderInput): string[] {
  const problems: string[] = []
  const age = AGE[builder.ageCategory]
  switch (step) {
    case 1:
      if (!builder.name.trim()) problems.push('Give the character a name.')
      break
    case 2: {
      const race = getCatalogue().races.get(builder.raceId)
      if (!race) {
        problems.push('Choose a race.')
        break
      }
      const subrace = race.subraces.find((s) => s.id === builder.subraceId)
      if (race.subraces.length > 0 && !subrace) problems.push('Choose a subrace.')
      for (const c of [...race.choices, ...(subrace?.choices ?? [])]) if (!builder.kinChoices[c.id]) problems.push(`Choose ${c.title}.`)
      break
    }
    case 3: {
      const dice = ABILITIES.map((a) => builder.dice[a.id])
      const sixes = dice.filter((d) => d === 6).length
      const fours = dice.filter((d) => d === 4).length
      if (sixes !== 2 || fours !== 2) problems.push(`Assign exactly two d6 and two d4 (now ${sixes} d6 and ${fours} d4).`)
      if (builder.ageBenefits.length !== age.picks) problems.push(`Choose ${count(age.picks)} ${age.label.toLowerCase()} benefit${age.picks === 1 ? '' : 's'}.`)
      if (builder.ageBenefits.includes('deep-knowledge') && !builder.deepKnowledgeAspect?.trim()) problems.push('Write the Deep Knowledge aspect.')
      break
    }
    case 4: {
      const rows = builder.professions
      const total = rows.reduce((n, p) => n + p.rank, 0)
      if (rows.length === 0) problems.push('Add at least one profession.')
      if (rows.some((p) => !p.name.trim())) problems.push('Name every profession.')
      if (new Set(rows.map((p) => named(p.name))).size !== rows.length) problems.push('Two professions have the same name.')
      if (rows.some((p) => p.rank < 1)) problems.push('Every profession needs at least 1 rank.')
      if (rows.some((p) => p.rank > age.cap)) problems.push(`No profession may have more than ${age.cap} ranks.`)
      if (total !== age.ranks) problems.push(`Profession ranks must add up to ${age.ranks} (now ${total}).`)
      if (builder.ageBenefits.includes('wisdom-of-experience') && !rows.some((p) => p.name.trim() && named(p.name) === named(builder.ageBenefitProfession ?? '')))
        problems.push('Choose the profession Wisdom of Experience applies to.')
      break
    }
    case 5:
      if (builder.createdAspects.some((a) => !a.trim())) problems.push('Write both aspects.')
      break
  }
  return problems
}

/** The highest step the step bar may jump to: every step before it is complete. */
export function reachableStep(builder: BuilderInput): StepNumber {
  for (let s = 1; s < STEPS.length; s++) if (stepProblems(s as StepNumber, builder).length > 0) return s as StepNumber
  return STEPS.length as StepNumber
}

const PLACEHOLDER = '·'

/**
 * The character this builder makes, with placeholders for the parts the earlier steps have not reached yet
 * (professions, written aspects, unfinished dice or age picks), so steps 3–5 can show the engine's HP, heart die,
 * speed, starting XP and granted aspects before the builder is complete. Null until a race and its choices are made.
 */
export function sketchCharacter(builder: BuilderInput): Character | null {
  const age = AGE[builder.ageCategory]
  const dice = ABILITIES.map((a) => builder.dice[a.id])
  const diceOk = dice.filter((d) => d === 6).length === 2 && dice.filter((d) => d === 4).length === 2
  const benefitsOk = builder.ageBenefits.length === age.picks
  const benefits = benefitsOk ? builder.ageBenefits : age.benefits.slice(0, age.picks).map((b) => b.id)
  const [first, ...rest] = age.ranks > age.cap ? [age.cap, age.ranks - age.cap] : [age.ranks]
  const filled: BuilderInput = {
    ...builder,
    dice: diceOk ? builder.dice : { might: 6, agility: 6, cunning: 4, presence: 4 },
    ageBenefits: benefits,
    deepKnowledgeAspect: builder.deepKnowledgeAspect?.trim() || PLACEHOLDER,
    ageBenefitProfession: `${PLACEHOLDER}0`,
    professions: [first, ...rest].map((rank, i) => ({ name: `${PLACEHOLDER}${i}`, rank })),
    createdAspects: [PLACEHOLDER, PLACEHOLDER],
  }
  try {
    return createCharacter(filled, getCatalogue())
  } catch (error) {
    if (error instanceof RuleError) return null
    throw error
  }
}

/**
 * The sketch character with the pending actions applied in order, an action the rules now refuse skipped (as
 * `previewDraft` does). Null until the sketch exists, that is until a kin and its choices are made. Steps 6–7 price
 * and edit against this when steps 1–5 are not finished.
 */
export function sketchPreview(builder: BuilderInput, pending: readonly ClientAction[]): Character | null {
  let character = sketchCharacter(builder)
  if (!character) return null
  for (const action of pending) {
    try {
      character = applyAction(character, action, getCatalogue()).character
    } catch (error) {
      if (!(error instanceof RuleError)) throw error
    }
  }
  return character
}

/**
 * Whether the step bar lets the player open step `n`: every step up to the first unfinished one, any finished step
 * 1–5, and step 6 or 7 once it holds an XP purchase or a gear action.
 */
export function stepOpen(n: StepNumber, builder: BuilderInput, pending: readonly ClientAction[]): boolean {
  if (n <= reachableStep(builder)) return true
  if (n <= 5) return stepProblems(n, builder).length === 0
  if (n === 6) return pending.some((a) => a.kind === 'xp:buy')
  return pending.some((a) => a.kind.startsWith('gear:'))
}

/** What a draft holds besides its id: steps 1–5 and the pending step 6–7 actions. */
export type DraftContent = { builder: BuilderInput; pending: ClientAction[] }

// ---- The preview ---------------------------------------------------------------------------------

export type DraftPreview = {
  /** The character the engine computes from the draft; null while the builder is incomplete. */
  character: Character | null
  /** Pending actions the rules now refuse (ruling 8), in pending order. */
  invalid: { action: ClientAction; code: RuleErrorCode; message: string }[]
  /** Why `createCharacter` refuses the builder; null when it accepts it. */
  builderError: { code: RuleErrorCode; message: string } | null
  /** The sketch character with the pending actions applied; null until a kin is chosen. */
  sketch: Character | null
}

export function computePreview(builder: BuilderInput, pending: ClientAction[]): DraftPreview {
  const draft: DraftState = { schemaVersion: 1, draft: true, builder, pending }
  try {
    const { character, invalid } = previewDraft(draft, getCatalogue())
    const byId = new Map(pending.map((a) => [a.id, a]))
    return {
      character,
      invalid: invalid.map((i) => ({ action: byId.get(i.actionId)!, code: i.error.code, message: i.error.message })),
      builderError: null,
      sketch: sketchPreview(builder, pending),
    }
  } catch (error) {
    if (!(error instanceof RuleError)) throw error
    return { character: null, invalid: [], builderError: { code: error.code, message: error.message }, sketch: sketchPreview(builder, pending) }
  }
}
