import type { Catalogue, PlayAbility, RaceEffect } from './catalogue'
import { startingXp } from './bloodmarks'
import type { Aspect, BuilderInput, Character, Profession, Talent, AbilityId, Attunement } from './types'
import { RuleError, SCHEMA_VERSION } from './types'

const YOUNG = ['natural-learner', 'fast-healer', 'young-and-foolish']
const ELDERLY = ['wisdom-of-experience', 'deep-knowledge', 'frail-body-sharp-mind']
const ABILITIES: AbilityId[] = ['might', 'agility', 'cunning', 'presence']

function validate(input: BuilderInput): void {
  const dice = ABILITIES.map(a => input.dice[a])
  if (dice.filter(d => d === 4).length !== 2 || dice.filter(d => d === 6).length !== 2) throw new RuleError('invalid_dice')
  const allowed = input.ageCategory === 'young' ? YOUNG : input.ageCategory === 'elderly' ? ELDERLY : []
  const benefits = input.ageBenefits
  const expected = input.ageCategory === 'young' ? 2 : input.ageCategory === 'elderly' ? 1 : 0
  if (benefits.length !== expected || new Set(benefits).size !== benefits.length || benefits.some(b => !allowed.includes(b)) ||
    (benefits.includes('deep-knowledge') && !input.deepKnowledgeAspect?.trim())) throw new RuleError('invalid_age_benefits')
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

  const professions: Profession[] = input.professions.map(p => ({ id: id(), name: p.name, rank: p.rank, challenges: 0, missions: 0, practiceWeeks: 0 }))
  const racialTalent = (ability: PlayAbility): Talent => ({ id: id(), catalogueId: null, titleSnapshot: ability.title, category: 'racial', frequency: ability.frequency ?? 'passive', destiny: false, customText: ability.body, usedThisPeriod: false, usesThisFight: 0 })
  const talents = [...race.abilities, ...(subrace?.abilities ?? [])].map(racialTalent)
  const raceEffects: RaceEffect[] = [...race.effects, ...(subrace?.effects ?? [])]
  const attunements: Attunement[] = raceEffects.filter(e => e.kind === 'attunement').map(effect => {
    const elements = effect.elements
    const element = elements.length === 1 ? elements[0] : input.attunementChoice
    if (!element || !elements.some(e => e.toLowerCase() === element.toLowerCase())) throw new RuleError('attunement_choice')
    return { id: id(), element, level: effect.level, source: 'race' }
  })
  const xp = startingXp(input.bloodmarkLevel)
  const awarded = xp + raceEffects.reduce((bonus, effect) => effect.kind === 'awardBonus' ? bonus + Math.floor(xp / effect.per) * effect.bonus : bonus, 0)
  const baseMax = subrace?.baseMaxHp ?? race.baseMaxHp ?? 40
  return {
    schemaVersion: SCHEMA_VERSION, draft: false,
    identity: { name: input.name, pronouns: input.pronouns, dream: input.dream, description: input.description, motivation: input.motivation, portrait: input.portrait, ageCategory: input.ageCategory, ageBenefits: [...input.ageBenefits] },
    kin: { raceId: race.id, subraceId: subrace?.id ?? null, titleSnapshot: subrace ? `${race.title} / ${subrace.title}` : race.title, spelltouched: input.spelltouched },
    attunements, path: null, bloodmarks: { level: input.bloodmarkLevel, abilities: [] },
    abilities: { might: { start: input.dice.might, current: input.dice.might }, agility: { start: input.dice.agility, current: input.dice.agility }, cunning: { start: input.dice.cunning, current: input.dice.cunning }, presence: { start: input.dice.presence, current: input.dice.presence } },
    hp: { baseMax, current: baseMax, heartDieCurrent: 8 }, wounds: [], conditions: [], aspects, professions, talents,
    gear: { weapons: [], armor: { name: '', weight: 'none', misc: 0, worn: false }, shield: { name: '', weight: 'none', misc: 0, worn: false }, items: [], coins: { iron: 0, obol: 0, lire: 0, ducat: 0, crown: 0 } },
    xp: { awarded, purchases: [] },
    play: { round: 1, rushPoints: 0, dp: 3, baseSpeed: input.ageCategory === 'elderly' ? 40 : 60, staminaSpentRound: null, failedRestStreak: 0, dpPerComplication: input.ageBenefits.includes('young-and-foolish') ? 2 : 1, professionChallengeDelta: input.ageBenefits.includes('natural-learner') ? -1 : 0 },
    raceEffects, notes: '',
  }
}
