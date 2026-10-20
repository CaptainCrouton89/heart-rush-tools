import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createCharacter } from '../src/create'
import { bloodmarkPicksOwed, startingXp } from '../src/bloodmarks'
import { speed } from '../src/derived'
import { price } from '../src/pricing'
import { indexById, type Catalogue, type PlayAbility, type PlayChoice, type PlayRace, type PlaySubrace, type PlayTalent, type RaceEffect } from '../src/catalogue'
import type { BuilderInput } from '../src/types'
import { conditions } from './fixtures'

const ability = (title: string, over: Partial<PlayAbility> = {}): PlayAbility => ({ title, frequency: 'passive', body: `${title} text`, grants: null, ...over })
const race = (title: string, over: Partial<PlayRace> = {}): PlayRace => ({ id: `race:${title}`, path: `/races/${title}`, title, size: 'Medium', image: null, aspects: [], abilities: [], choices: [], subraces: [], effects: [], ...over })
const subrace = (id: string, over: Partial<PlaySubrace> = {}): PlaySubrace => ({ id, title: id, aspects: [], abilities: [], choices: [], effects: [], ...over })
const centaur = race('Centaur', { aspects: ['Fury of the herd', 'Trample the weak'], abilities: [ability('Thundering Charge', { frequency: 'major' }), ability('Hoof Strike')] })
const gnome = race('Gnome', { effects: [{ kind: 'cost', purchase: 'hp', delta: 1 }], subraces: [subrace('whiteling', { aspects: ['Fragile as glass'], abilities: [ability("Oracle's Burden", { grants: { talentId: 'player.talents.oracle', destiny: true } })], baseMaxHp: 25, effects: [{ kind: 'cost', purchase: 'hp', delta: 1 }, { kind: 'dieCap', ability: 'might', max: 6 }] })] })
const martialDiscount: RaceEffect[] = [{ kind: 'cost', purchase: 'talent:*', delta: -2, where: { tradition: 'Martial' } }, { kind: 'cost', purchase: 'destiny', delta: -2, where: { tradition: 'Martial' } }]
const cognitiveDiscount: RaceEffect[] = [{ kind: 'cost', purchase: 'talent:*', delta: -2, where: { tradition: 'Cognitive' } }, { kind: 'cost', purchase: 'destiny', delta: -2, where: { tradition: 'Cognitive' } }]
const expertise: PlayChoice = { id: 'expertise', title: 'Expertise', text: 'Choose one:', kind: 'options', options: [{ id: 'martial', title: 'Martial', abilities: [], effects: martialDiscount }, { id: 'cognitive', title: 'Cognitive', abilities: [], effects: cognitiveDiscount }] }
const elf = race('Elf', { effects: [{ kind: 'aspectRankCap', max: 8 }], subraces: [subrace('amverela', { aspects: ['Cautious'], abilities: [ability('Expertise')], choices: [expertise] })] })
const dwarf = race('Dwarf', { effects: [{ kind: 'cost', purchase: 'hp', delta: -1 }] })
const shontobiPath: PlayChoice = { id: 'path', title: 'Path', text: 'Choose One:', kind: 'options', options: [
  { id: 'eagle-companion', title: 'Eagle Companion', abilities: [ability('Eagle Companion', { grants: { talentId: 'player.talents.beast-companion', destiny: false } })], effects: [] },
  { id: 'honor-bound', title: 'Honor Bound', abilities: [ability('Honor Bound')], effects: [{ kind: 'cost', purchase: 'aspect:rank', delta: -1, where: { honor: true } }] },
] }
const nuunElement: PlayChoice = { id: 'element', title: 'Element', text: 'Choose fire or water.', kind: 'options', options: [
  { id: 'fire', title: 'Fire', abilities: [], effects: [{ kind: 'attunement', elements: ['fire'], level: 'basic' }] },
  { id: 'water', title: 'Water', abilities: [], effects: [{ kind: 'attunement', elements: ['water'], level: 'basic' }] },
] }
const human = race('Human', {
  choices: [{ id: 'resilience-talent', title: 'Resilience and Diversity', text: 'Choose one talent.', kind: 'talent', tradition: null }],
  subraces: [
    subrace('nuun', { abilities: [ability('Elemental Heritage')], choices: [nuunElement] }),
    subrace('shontobi', { choices: [shontobiPath] }),
    subrace('husakas', { choices: [{ id: 'dust-talent', title: 'Dust Dependency', text: 'Choose any handmagic talent.', kind: 'talent', tradition: 'Handmagic' }] }),
  ],
})
const mira = race('Mira', { choices: [{ id: 'caste', title: 'Caste', text: 'Choose a caste.', kind: 'options', options: [
  { id: 'male', title: 'Male', abilities: [], effects: [] },
  { id: 'female', title: 'Female', abilities: [], effects: [{ kind: 'cost', purchase: 'talent:elemental', delta: -2 }] },
  { id: 'common', title: 'Common', abilities: [], effects: [] },
] }] })
const elnir = race('Elnir', { choices: [{ id: 'augmentation', title: 'Augmentation', text: 'Choose an augmentation.', kind: 'options', options: ['venomous', 'wall-climber', 'armored-hide', 'enhanced-senses'].map(id => ({ id, title: id, abilities: [], effects: [] })) }] })
const craven = race('Craven', { effects: [{ kind: 'awardBonus', per: 7, bonus: 1 }] })
const talent = (slug: string, title: string, over: Partial<PlayTalent> = {}): PlayTalent => ({ id: `player.talents.${slug}`, path: `/talents/${slug}`, title, category: 'combat', frequency: 'minor', tradition: null, elements: [], body: '', destiny: null, ...over })
const talents = [
  talent('beast-companion', 'Beast Companion', { category: 'noncombat', frequency: 'passive' }),
  talent('oracle', 'Oracle', { category: 'noncombat', frequency: 'weekly' }),
  talent('quick-draw', 'Quick Draw', { tradition: 'Martial' }),
  talent('spark', 'Spark', { category: 'elemental', tradition: 'Handmagic', elements: ['Fire'] }),
]
const catalogue: Catalogue = { races: indexById([centaur, gnome, elf, dwarf, human, mira, elnir, craven]), talents: indexById(talents), conditions }
const input = (over: Partial<BuilderInput> = {}): BuilderInput => ({ id: '01TEST', at: '2026-01-01T00:00:00Z', name: 'Kaelen', pronouns: 'they', dream: 'Explore', description: '', motivation: '', portrait: null, raceId: centaur.id, subraceId: null, kinChoices: {}, spelltouched: false, dice: { might: 6, agility: 4, cunning: 6, presence: 4 }, ageCategory: 'adult', ageBenefits: [], createdAspects: ['Brave', 'Curious'], professions: [{ name: 'Scout', rank: 3 }, { name: 'Herbalist', rank: 1 }], bloodmarkLevel: 0, ...over })
const error = (code: string, fn: () => unknown) => assert.throws(fn, (e: any) => e.code === code)

describe('criterion 16: createCharacter', () => {
  test('Centaur adult gets race and two created aspects, both racial talents, HP 40, DP 3, speed 60, 5 XP', () => {
    const c = createCharacter(input(), catalogue)
    assert.deepEqual(c.aspects.map(a => [a.text, a.rank, a.source]), [['Fury of the herd', 1, 'race'], ['Trample the weak', 1, 'race'], ['Brave', 1, 'created'], ['Curious', 1, 'created']])
    assert.deepEqual(c.talents.map(t => [t.titleSnapshot, t.frequency, t.category]), [['Thundering Charge', 'major', 'racial'], ['Hoof Strike', 'passive', 'racial']])
    assert.equal(c.hp.baseMax, 40)
    assert.equal(c.hp.current, 40)
    assert.equal(c.hp.heartDieCurrent, 8)
    assert.equal(c.play.dp, 3)
    assert.equal(speed(c), 60)
    assert.equal(c.xp.awarded, 5)
    assert.deepEqual(c.xp.purchases, [])
  })
  test('elderly Deep Knowledge has named rank 3 aspect, speed 40, 5 profession ranks, cap 4', () => {
    const c = createCharacter(input({ ageCategory: 'elderly', ageBenefits: ['deep-knowledge'], deepKnowledgeAspect: 'Living Encyclopedia', professions: [{ name: 'Scholar', rank: 4 }, { name: 'Sailor', rank: 1 }] }), catalogue)
    assert.ok(c.aspects.some(a => a.text === 'Living Encyclopedia' && a.rank === 3 && a.source === 'age'))
    assert.equal(speed(c), 40)
    assert.deepEqual(c.professions.map(p => p.rank), [4, 1])
    error('invalid_professions', () => createCharacter(input({ ageCategory: 'elderly', ageBenefits: ['deep-knowledge'], deepKnowledgeAspect: 'Scholar', professions: [{ name: 'Scholar', rank: 5 }] }), catalogue))
  })
  test('young Natural Learner and Young and Foolish change their play fields with 2 ranks', () => {
    const c = createCharacter(input({ ageCategory: 'young', ageBenefits: ['natural-learner', 'young-and-foolish'], professions: [{ name: 'Scout', rank: 2 }] }), catalogue)
    assert.equal(c.play.professionChallengeDelta, -1)
    assert.equal(c.play.dpPerComplication, 2)
    assert.deepEqual(c.professions.map(p => p.rank), [2])
    assert.equal(c.aspects.find(a => a.source === 'age')?.text, 'Eager to Prove Myself')
    error('invalid_age_benefits', () => createCharacter(input({ ageCategory: 'young', ageBenefits: ['natural-learner'], professions: [{ name: 'Scout', rank: 2 }] }), catalogue))
  })
  test('age benefit validation refuses duplicates and an empty Deep Knowledge aspect', () => {
    error('invalid_age_benefits', () => createCharacter(input({ ageCategory: 'young', ageBenefits: ['fast-healer', 'fast-healer'], professions: [{ name: 'Scout', rank: 2 }] }), catalogue))
    error('invalid_age_benefits', () => createCharacter(input({ ageCategory: 'elderly', ageBenefits: ['deep-knowledge'], deepKnowledgeAspect: '   ', professions: [{ name: 'Scholar', rank: 4 }, { name: 'Sailor', rank: 1 }] }), catalogue))
  })
  test('invalid dice, professions, race and subrace refuse', () => {
    error('invalid_dice', () => createCharacter(input({ dice: { might: 6, agility: 6, cunning: 6, presence: 4 } }), catalogue))
    error('invalid_professions', () => createCharacter(input({ professions: [{ name: 'Scholar', rank: 4 }] }), catalogue))
    error('unknown_race', () => createCharacter(input({ raceId: 'missing' }), catalogue))
    error('unknown_subrace', () => createCharacter(input({ subraceId: 'missing' }), catalogue))
    error('unknown_subrace', () => createCharacter(input({ raceId: gnome.id }), catalogue))
    error('bad_action', () => createCharacter(input({ createdAspects: ['Brave', ' '] }), catalogue))
  })
  test('race and subrace effects and base HP are copied', () => {
    const w = createCharacter(input({ raceId: gnome.id, subraceId: 'whiteling' }), catalogue)
    assert.equal(w.hp.baseMax, 25)
    assert.equal(w.hp.current, 25)
    assert.equal(w.raceEffects.length, 3)
    assert.equal(w.raceEffects.filter(e => e.kind === 'cost' && e.purchase === 'hp').length, 2)
  })
  test('same input is deeply equal and every created record has id <input.id>:<n>', () => {
    const i = input({ ageCategory: 'elderly', ageBenefits: ['frail-body-sharp-mind'], professions: [{ name: 'Scout', rank: 4 }, { name: 'Sailor', rank: 1 }] })
    const c = createCharacter(i, catalogue)
    assert.deepEqual(c, createCharacter(i, catalogue))
    const ids = [...c.aspects.map(a => a.id), ...c.professions.map(p => p.id), ...c.talents.map(t => t.id), ...c.attunements.map(a => a.id)]
    assert.deepEqual(ids.slice().sort((a, b) => Number(a.split(':').at(-1)) - Number(b.split(':').at(-1))), Array.from({ length: ids.length }, (_, n) => `${i.id}:${n}`))
  })
  test('ids run aspects, professions, abilities with their grants, chosen option and talent picks, then attunements', () => {
    const c = createCharacter(input({ raceId: human.id, subraceId: 'nuun', kinChoices: { 'resilience-talent': 'player.talents.quick-draw', element: 'fire' } }), catalogue)
    assert.deepEqual([...c.aspects, ...c.professions, ...c.talents, ...c.attunements].map(r => [r.id, 'text' in r ? r.text : 'name' in r ? r.name : 'titleSnapshot' in r ? r.titleSnapshot : r.element]),
      [['01TEST:0', 'Brave'], ['01TEST:1', 'Curious'], ['01TEST:2', 'Scout'], ['01TEST:3', 'Herbalist'], ['01TEST:4', 'Elemental Heritage'], ['01TEST:5', 'Quick Draw'], ['01TEST:6', 'fire']])
  })
})

describe('criterion 8b: bloodmarks and starting XP', () => {
  test('starting XP follows levels 0 through 6, including Craven bonus', () => {
    for (const [level, xp] of [[0, 5], [1, 15], [2, 30], [3, 50], [4, 80], [5, 120], [6, 160]]) assert.equal(startingXp(level), xp)
    assert.equal(createCharacter(input({ bloodmarkLevel: 3 }), catalogue).xp.awarded, 50)
    assert.equal(createCharacter(input({ raceId: craven.id, bloodmarkLevel: 2 }), catalogue).xp.awarded, 34)
  })
  test('owed picks at levels 0, 2 and 3 exclude already chosen abilities', () => {
    const c = createCharacter(input({ bloodmarkLevel: 3 }), catalogue)
    assert.deepEqual(bloodmarkPicksOwed(createCharacter(input(), catalogue)), { specialization: 0, signature: 0, mastery: 0, paragon: 0 })
    assert.deepEqual(bloodmarkPicksOwed({ ...c, bloodmarks: { level: 2, abilities: [] } }), { specialization: 2, signature: 1, mastery: 0, paragon: 0 })
    assert.deepEqual(bloodmarkPicksOwed(c), { specialization: 2, signature: 3, mastery: 0, paragon: 0 })
    assert.deepEqual(bloodmarkPicksOwed({ ...c, bloodmarks: { level: 3, abilities: [{ id: 'x', kind: 'signature', title: '', text: '', grantedAtLevel: 2 }] } }), { specialization: 2, signature: 2, mastery: 0, paragon: 0 })
  })
})

describe('kin choices and racial grants', () => {
  const amverela = (choice?: string) => createCharacter(input({ raceId: elf.id, subraceId: 'amverela', kinChoices: choice ? { expertise: choice } : {} }), catalogue)
  const martialTalent = { tradition: 'Martial' as const }
  const cognitiveTalent = { tradition: 'Cognitive' as const }

  test('Amverela martial discounts only Martial talents and destiny, cognitive only Cognitive', () => {
    const m = amverela('martial')
    assert.deepEqual(m.kin.choices, { expertise: 'martial' })
    assert.deepEqual(m.raceEffects, [...elf.effects, ...martialDiscount])
    assert.equal(price(m, 'talent:combat', { talent: martialTalent }), 1)
    assert.equal(price(m, 'talent:combat', { talent: cognitiveTalent }), 3)
    const c = amverela('cognitive')
    assert.equal(price(c, 'talent:combat', { talent: martialTalent }), 3)
    assert.equal(price(c, 'talent:combat', { talent: cognitiveTalent }), 1)
    assert.deepEqual(c.talents.map(t => t.titleSnapshot), ['Expertise'])
  })
  test('Shontobi eagle-companion grants Beast Companion and no honor discount', () => {
    const c = createCharacter(input({ raceId: human.id, subraceId: 'shontobi', kinChoices: { 'resilience-talent': 'player.talents.quick-draw', path: 'eagle-companion' } }), catalogue)
    assert.deepEqual(c.talents.map(t => [t.catalogueId, t.titleSnapshot, t.category, t.destiny]), [['player.talents.quick-draw', 'Quick Draw', 'racial', false], [null, 'Eagle Companion', 'racial', false], ['player.talents.beast-companion', 'Beast Companion', 'racial', false]])
    assert.deepEqual(c.raceEffects, [])
    assert.equal(c.talents[2].customText, null)
    assert.equal(c.talents[2].frequency, 'passive')
  })
  test('Shontobi honor-bound discounts honor aspect ranks and grants no eagle', () => {
    const c = createCharacter(input({ raceId: human.id, subraceId: 'shontobi', kinChoices: { 'resilience-talent': 'player.talents.quick-draw', path: 'honor-bound' } }), catalogue)
    assert.deepEqual(c.talents.map(t => t.titleSnapshot), ['Quick Draw', 'Honor Bound'])
    const honorable = { ...c, aspects: [{ id: 'a', text: 'Duty', rank: 1, source: 'created' as const, honor: true }, { id: 'b', text: 'Fun', rank: 1, source: 'created' as const, honor: false }] }
    assert.equal(price(honorable, 'aspect:rank', { aspectId: 'a' }), 1)
    assert.equal(price(honorable, 'aspect:rank', { aspectId: 'b' }), 2)
  })
  test('Nuun fire and water each give exactly one attunement', () => {
    for (const element of ['fire', 'water']) {
      const c = createCharacter(input({ raceId: human.id, subraceId: 'nuun', kinChoices: { 'resilience-talent': 'player.talents.quick-draw', element } }), catalogue)
      assert.deepEqual(c.attunements.map(a => [a.element, a.level, a.source]), [[element, 'basic', 'race']])
      assert.equal(c.kin.choices.element, element)
    }
  })
  test('Human resilience-talent adds the chosen catalogue talent as a racial talent', () => {
    const c = createCharacter(input({ raceId: human.id, subraceId: 'shontobi', kinChoices: { 'resilience-talent': 'player.talents.oracle', path: 'honor-bound' } }), catalogue)
    const picked = c.talents.find(t => t.catalogueId === 'player.talents.oracle')!
    assert.deepEqual([picked.category, picked.titleSnapshot, picked.destiny, picked.frequency], ['racial', 'Oracle', false, 'weekly'])
    assert.equal(c.kin.choices['resilience-talent'], 'player.talents.oracle')
  })
  test('Husakas dust-talent must be a Handmagic talent', () => {
    const answers = (dust: string) => ({ 'resilience-talent': 'player.talents.quick-draw', 'dust-talent': dust })
    const c = createCharacter(input({ raceId: human.id, subraceId: 'husakas', kinChoices: answers('player.talents.spark') }), catalogue)
    assert.deepEqual(c.talents.map(t => t.titleSnapshot), ['Quick Draw', 'Spark'])
    error('kin_choice', () => createCharacter(input({ raceId: human.id, subraceId: 'husakas', kinChoices: answers('player.talents.quick-draw') }), catalogue))
  })
  test('Mira female takes the elemental discount; male and common do not', () => {
    const withFire = (caste: string) => ({ ...createCharacter(input({ raceId: mira.id, kinChoices: { caste } }), catalogue), attunements: [{ id: 'x', element: 'fire', level: 'basic' as const, source: 'race' }] })
    const target = { talent: { elements: ['Fire'] } }
    assert.equal(price(withFire('female'), 'talent:elemental', target), 1)
    assert.equal(price(withFire('male'), 'talent:elemental', target), 3)
    assert.equal(price(withFire('common'), 'talent:elemental', target), 3)
  })
  test('Elnir stores the chosen augmentation with no effects', () => {
    const c = createCharacter(input({ raceId: elnir.id, kinChoices: { augmentation: 'wall-climber' } }), catalogue)
    assert.deepEqual(c.kin.choices, { augmentation: 'wall-climber' })
    assert.deepEqual(c.raceEffects, [])
  })
  test('an unanswered, unknown or wrong-tradition choice is kin_choice, and an unrelated key is ignored', () => {
    error('kin_choice', () => amverela())
    error('kin_choice', () => amverela('arcane'))
    error('kin_choice', () => createCharacter(input({ raceId: human.id, subraceId: 'nuun', kinChoices: { element: 'fire' } }), catalogue))
    error('kin_choice', () => createCharacter(input({ raceId: human.id, subraceId: 'nuun', kinChoices: { 'resilience-talent': 'player.talents.missing', element: 'fire' } }), catalogue))
    error('kin_choice', () => createCharacter(input({ raceId: elnir.id, kinChoices: { augmentation: 'toxic' } }), catalogue))
    assert.deepEqual(createCharacter(input({ raceId: elnir.id, kinChoices: { augmentation: 'venomous', stray: 'x' } }), catalogue).kin.choices, { augmentation: 'venomous' })
  })
  test('Whiteling Oracle grant adds Oracle with destiny true right after the ability', () => {
    const c = createCharacter(input({ raceId: gnome.id, subraceId: 'whiteling' }), catalogue)
    assert.deepEqual(c.talents.map(t => [t.catalogueId, t.titleSnapshot, t.category, t.destiny]), [[null, "Oracle's Burden", 'racial', false], ['player.talents.oracle', 'Oracle', 'racial', true]])
    assert.equal(price(c, 'destiny'), 6)
  })
  test('a grant naming a talent missing from the catalogue is refused', () => {
    const broken = race('Broken', { abilities: [ability('Bond', { grants: { talentId: 'player.talents.nope', destiny: false } })] })
    error('not_found', () => createCharacter(input({ raceId: broken.id }), { ...catalogue, races: indexById([broken]) }))
  })
  test('Wisdom of Experience names one starting profession that rerolls 1s', () => {
    const elder = (over: Partial<BuilderInput>) => input({ ageCategory: 'elderly', ageBenefits: ['wisdom-of-experience'], professions: [{ name: 'Scholar', rank: 4 }, { name: 'Sailor', rank: 1 }], ...over })
    const c = createCharacter(elder({ ageBenefitProfession: 'sailor' }), catalogue)
    assert.deepEqual(c.professions.map(p => [p.name, p.rerollOnes]), [['Scholar', false], ['Sailor', true]])
    error('invalid_age_benefits', () => createCharacter(elder({}), catalogue))
    error('invalid_age_benefits', () => createCharacter(elder({ ageBenefitProfession: 'Smith' }), catalogue))
    assert.ok(createCharacter(input(), catalogue).professions.every(p => !p.rerollOnes))
  })
})
