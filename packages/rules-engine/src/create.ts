import type { Catalogue, PlayAbility, PlayChoice, RaceEffect } from './catalogue'
import { startingXp } from './bloodmarks'
import type { Aspect, BuilderInput, Character, Profession, Talent, AbilityId, Attunement } from './types'
import { RuleError, SCHEMA_VERSION } from './types'

const YOUNG = ['natural-learner', 'fast-healer', 'young-and-foolish']
const ELDERLY = ['wisdom-of-experience', 'deep-knowledge', 'frail-body-sharp-mind']
const ABILITIES: AbilityId[] = ['might', 'agility', 'cunning', 'presence']

const sameName = (a: string, b: string | undefined) => b !== undefined && a.trim().toLowerCase() === b.trim().toLowerCase()

function validate(input: BuilderInput): void {
  const dice = ABILITIES.map(a => input.dice[a])
  if (dice.filter(d => d === 4).length !== 2 || dice.filter(d => d === 6).length !== 2) throw new RuleError('invalid_dice')
  const allowed = input.ageCategory === 'young' ? YOUNG : input.ageCategory === 'elderly' ? ELDERLY : []
  const benefits = input.ageBenefits
  const expected = input.ageCategory === 'young' ? 2 : input.ageCategory === 'elderly' ? 1 : 0
  if (benefits.length !== expected || new Set(benefits).size !== benefits.length || benefits.some(b => !allowed.includes(b)) ||
    (benefits.includes('deep-knowledge') && !input.deepKnowledgeAspect?.trim())) throw new RuleError('invalid_age_benefits')
  // Wisdom of Experience (Building_Your_Character.md: "Choose one of your starting professions").
  if (benefits.includes('wisdom-of-experience') && !input.professions.some(p => sameName(p.name, input.ageBenefitProfession))) throw new RuleError('invalid_age_benefits', 'wisdom-of-experience needs ageBenefitProfession to name a starting profession')
  const ranks = input.ageCategory === 'young' ? 2 : input.ageCategory === 'elderly' ? 5 : 4
  const cap = input.ageCategory === 'elderly' ? 4 : 3
  if (input.professions.length > 3 || input.professions.reduce((n, p) => n + p.rank, 0) !== ranks ||
    input.professions.some(p => !p.name.trim() || !Number.isInteger(p.rank) || p.rank < 1 || p.rank > cap) ||
    new Set(input.professions.map(p => p.name.trim().toLowerCase())).size !== input.professions.length) throw new RuleError('invalid_professions')
}

/** Racial and age grants have zero purchase cost; the first XP award includes race bonuses. */
export function createCharacter(input: BuilderInput, catalogue: Catalogue): Character {
  const race = catalogue.races.get(input.raceId)
  if (!race) throw new RuleError('unknown_race')
  const subrace = input.subraceId === null ? null : race.subraces.find(s => s.id === input.subraceId)
  if ((input.subraceId !== null && !subrace) || (input.subraceId === null && race.subraces.length > 0)) throw new RuleError('unknown_subrace')
  validate(input)
  if (input.createdAspects.some(text => !text.trim())) throw new RuleError('bad_action', 'created aspects must not be empty')

  let next = 0
  const id = () => `${input.id}:${next++}`
  const aspect = (text: string, rank: number, source: Aspect['source']): Aspect => ({ id: id(), text, rank, source, honor: false })
  const aspects: Aspect[] = [...race.aspects, ...(subrace?.aspects ?? [])].map(text => aspect(text, 1, 'race'))
  if (input.ageCategory === 'young') aspects.push(aspect('Eager to Prove Myself', 1, 'age'))
  if (input.ageCategory === 'elderly') aspects.push(aspect('Wisdom of Years', 1, 'age'))
  if (input.ageBenefits.includes('deep-knowledge')) aspects.push(aspect(input.deepKnowledgeAspect!.trim(), 3, 'age'))
  if (input.ageBenefits.includes('frail-body-sharp-mind')) aspects.push(aspect('Frail', 3, 'age'))
  for (const text of input.createdAspects) aspects.push(aspect(text, 1, 'created'))

  const wisdom = input.ageBenefits.includes('wisdom-of-experience')
  const professions: Profession[] = input.professions.map(p => ({ id: id(), name: p.name, rank: p.rank, challenges: 0, missions: 0, practiceWeeks: 0, rerollOnes: wisdom && sameName(p.name, input.ageBenefitProfession) }))

  const talentRow = (catalogueId: string | null, titleSnapshot: string, frequency: Talent['frequency'], destiny: boolean, customText: string | null): Talent =>
    ({ id: id(), catalogueId, titleSnapshot, category: 'racial', frequency, destiny, customText, usedThisPeriod: false, usesThisFight: 0 })
  const catalogueTalent = (talentId: string, destiny: boolean): Talent => {
    const entry = catalogue.talents.get(talentId)
    if (!entry) throw new RuleError('not_found', `racial talent ${talentId} is not in the catalogue`)
    return talentRow(entry.id, entry.title, entry.frequency ?? 'passive', destiny, null)
  }
  /** An ability, then the talent it grants. */
  const abilityTalents = (ability: PlayAbility): Talent[] => [
    talentRow(null, ability.title, ability.frequency ?? 'passive', false, ability.body),
    ...(ability.grants ? [catalogueTalent(ability.grants.talentId, ability.grants.destiny)] : []),
  ]
  const talents = [...race.abilities, ...(subrace?.abilities ?? [])].flatMap(abilityTalents)
  const raceEffects: RaceEffect[] = [...race.effects, ...(subrace?.effects ?? [])]
  // Every choice on the race and subrace must be answered; only the answered option's abilities and effects are applied.
  const choices: Record<string, string> = {}
  const choose = (choice: PlayChoice): void => {
    const answer = input.kinChoices[choice.id]
    if (choice.kind === 'options') {
      const option = choice.options.find(o => o.id === answer)
      if (!option) throw new RuleError('kin_choice', `${choice.id}: choose one of ${choice.options.map(o => o.id).join(', ')}`)
      talents.push(...option.abilities.flatMap(abilityTalents))
      raceEffects.push(...option.effects)
    } else {
      const entry = answer === undefined ? undefined : catalogue.talents.get(answer)
      if (!entry || (choice.tradition !== null && entry.tradition !== choice.tradition)) throw new RuleError('kin_choice', `${choice.id}: ${answer ?? 'no answer'} is not a${choice.tradition ? ` ${choice.tradition}` : ''} catalogue talent`)
      talents.push(catalogueTalent(entry.id, false))
    }
    choices[choice.id] = answer
  }
  for (const choice of [...race.choices, ...(subrace?.choices ?? [])]) choose(choice)
  const attunements: Attunement[] = raceEffects.flatMap(e => e.kind === 'attunement' ? [{ id: id(), element: e.elements[0], level: e.level, source: 'race' }] : [])
  const xp = startingXp(input.bloodmarkLevel)
  const awarded = xp + raceEffects.reduce((bonus, effect) => effect.kind === 'awardBonus' ? bonus + Math.floor(xp / effect.per) * effect.bonus : bonus, 0)
  const baseMax = subrace?.baseMaxHp ?? race.baseMaxHp ?? 40
  return {
    schemaVersion: SCHEMA_VERSION, draft: false,
    identity: { name: input.name, pronouns: input.pronouns, dream: input.dream, description: input.description, motivation: input.motivation, portrait: input.portrait, ageCategory: input.ageCategory, ageBenefits: [...input.ageBenefits] },
    kin: { raceId: race.id, subraceId: subrace?.id ?? null, titleSnapshot: subrace ? `${race.title} / ${subrace.title}` : race.title, spelltouched: input.spelltouched, choices },
    attunements, path: null, bloodmarks: { level: input.bloodmarkLevel, abilities: [] },
    abilities: { might: { start: input.dice.might, current: input.dice.might }, agility: { start: input.dice.agility, current: input.dice.agility }, cunning: { start: input.dice.cunning, current: input.dice.cunning }, presence: { start: input.dice.presence, current: input.dice.presence } },
    hp: { baseMax, current: baseMax, heartDieCurrent: 8 }, wounds: [], conditions: [], aspects, professions, talents,
    gear: { weapons: [], armor: { name: '', weight: 'none', misc: 0, worn: false }, shield: { name: '', weight: 'none', misc: 0, worn: false }, items: [], coins: { iron: 0, obol: 0, lire: 0, ducat: 0, crown: 0 } },
    xp: { awarded, purchases: [] },
    play: { round: 1, rushPoints: 0, dp: 3, baseSpeed: input.ageCategory === 'elderly' ? 40 : 60, staminaSpentRound: null, failedRestStreak: 0, dpPerComplication: input.ageBenefits.includes('young-and-foolish') ? 2 : 1, professionChallengeDelta: input.ageBenefits.includes('natural-learner') ? -1 : 0 },
    raceEffects, notes: '',
  }
}
