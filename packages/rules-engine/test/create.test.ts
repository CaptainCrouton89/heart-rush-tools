import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createCharacter } from '../src/create'
import { bloodmarkPicksOwed, startingXp } from '../src/bloodmarks'
import { speed } from '../src/derived'
import { indexById, type Catalogue, type PlayRace } from '../src/catalogue'
import type { BuilderInput } from '../src/types'
import { conditions } from './fixtures'

const race = (title: string, over: Partial<PlayRace> = {}): PlayRace => ({ id: `race:${title}`, path: `/races/${title}`, title, size: 'Medium', image: null, aspects: [], abilities: [], subraces: [], effects: [], ...over })
const centaur = race('Centaur', { aspects: ['Fury of the herd', 'Trample the weak'], abilities: [{ title: 'Thundering Charge', frequency: 'major', body: '' }, { title: 'Hoof Strike', frequency: 'passive', body: '' }] })
const gnome = race('Gnome', { effects: [{ kind: 'cost', purchase: 'hp', delta: 1 }], subraces: [{ id: 'whiteling', title: 'Whiteling', aspects: ['Fragile as glass'], abilities: [], baseMaxHp: 25, effects: [{ kind: 'cost', purchase: 'hp', delta: 1 }, { kind: 'dieCap', ability: 'might', max: 6 }] }] })
const elf = race('Elf', { effects: [{ kind: 'aspectRankCap', max: 8 }], subraces: [{ id: 'amverela', title: 'Amverela', aspects: ['Cautious'], abilities: [], effects: [{ kind: 'cost', purchase: 'talent:*', delta: -2, where: { tradition: 'Martial' } }] }] })
const dwarf = race('Dwarf', { effects: [{ kind: 'cost', purchase: 'hp', delta: -1 }] })
const human = race('Human', { subraces: [{ id: 'nuun', title: 'Nuun', aspects: [], abilities: [], effects: [{ kind: 'attunement', elements: ['fire', 'water'], level: 'basic' }] }, { id: 'shontobi', title: 'Shontobi', aspects: [], abilities: [], effects: [{ kind: 'cost', purchase: 'aspect:rank', delta: -1, where: { honor: true } }] }] })
const craven = race('Craven', { effects: [{ kind: 'awardBonus', per: 7, bonus: 1 }] })
const catalogue: Catalogue = { races: indexById([centaur, gnome, elf, dwarf, human, craven]), talents: indexById([]), conditions }
const input = (over: Partial<BuilderInput> = {}): BuilderInput => ({ id: '01TEST', at: '2026-01-01T00:00:00Z', name: 'Kaelen', pronouns: 'they', dream: 'Explore', description: '', motivation: '', portrait: null, raceId: centaur.id, subraceId: null, spelltouched: false, dice: { might: 6, agility: 4, cunning: 6, presence: 4 }, ageCategory: 'adult', ageBenefits: [], createdAspects: ['Brave', 'Curious'], professions: [{ name: 'Scout', rank: 3 }, { name: 'Herbalist', rank: 1 }], bloodmarkLevel: 0, ...over })
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
  test('race and subrace effects, base HP and racial attunement are copied', () => {
    const w = createCharacter(input({ raceId: gnome.id, subraceId: 'whiteling' }), catalogue)
    assert.equal(w.hp.baseMax, 25)
    assert.equal(w.hp.current, 25)
    assert.equal(w.raceEffects.length, 3)
    assert.equal(w.raceEffects.filter(e => e.kind === 'cost' && e.purchase === 'hp').length, 2)
    const n = createCharacter(input({ raceId: human.id, subraceId: 'nuun', attunementChoice: 'fire' }), catalogue)
    assert.deepEqual(n.attunements.map(a => [a.element, a.level, a.source]), [['fire', 'basic', 'race']])
    error('attunement_choice', () => createCharacter(input({ raceId: human.id, subraceId: 'nuun' }), catalogue))
    error('attunement_choice', () => createCharacter(input({ raceId: human.id, subraceId: 'nuun', attunementChoice: 'earth' }), catalogue))
    assert.deepEqual(createCharacter(input({ raceId: elf.id, subraceId: 'amverela' }), catalogue).raceEffects, [...elf.effects, ...elf.subraces[0].effects])
  })
  test('same input is deeply equal and every created record has id <input.id>:<n>', () => {
    const i = input({ ageCategory: 'elderly', ageBenefits: ['frail-body-sharp-mind'], professions: [{ name: 'Scout', rank: 4 }, { name: 'Sailor', rank: 1 }] })
    const c = createCharacter(i, catalogue)
    assert.deepEqual(c, createCharacter(i, catalogue))
    const ids = [...c.aspects.map(a => a.id), ...c.professions.map(p => p.id), ...c.talents.map(t => t.id), ...c.attunements.map(a => a.id)]
    assert.deepEqual(ids.slice().sort((a, b) => Number(a.split(':').at(-1)) - Number(b.split(':').at(-1))), Array.from({ length: ids.length }, (_, n) => `${i.id}:${n}`))
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
