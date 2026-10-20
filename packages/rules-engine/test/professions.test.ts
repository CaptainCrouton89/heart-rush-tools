import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCharacter } from './fixtures'
import { professionProgress, reduceProfessionProgress, isProfessionProgressAction } from '../src/professions'
import { RuleError, type Action, type Character, type Profession } from '../src/types'

const profession: Profession = { id: 'p', name: 'Smith', rank: 2, challenges: 0, missions: 0, practiceWeeks: 0 }
const action = (kind: Action['kind'], extras: Record<string, unknown> = {}) => ({ id: 'event', at: '2026-10-20T00:00:00.000Z', kind, professionId: 'p', ...extras }) as Action
const character = (p: Profession = profession): Character => makeCharacter({ professions: [p] })

function apply(c: Character, kind: Action['kind'], extras: Record<string, unknown> = {}): Character {
  const a = action(kind, extras)
  if (!isProfessionProgressAction(a)) throw Error('expected profession progress action')
  return reduceProfessionProgress(c, a)
}

test('advancement table and max heart die, with extra challenges reducing practice', () => {
  assert.deepEqual(professionProgress(character(), 'p'), {
    rank: 2, rankName: 'Apprentice', nextRankName: 'Journeyman', challengesNeeded: 4,
    missionRequired: true, practiceNeeded: 9, challengeCn: 10, canAdvance: false, highest: false,
  })
  assert.equal(professionProgress(character({ ...profession, challenges: 5 }), 'p').practiceNeeded, 8)
  assert.equal(professionProgress(character({ ...profession, challenges: 20 }), 'p').practiceNeeded, 0)
  const natural = character()
  natural.play.professionChallengeDelta = -1
  assert.equal(professionProgress(natural, 'p').challengesNeeded, 3)
  assert.deepEqual(professionProgress(character({ ...profession, rank: 0 }), 'p'), {
    rank: 0, rankName: '', nextRankName: 'Novice', challengesNeeded: 2,
    missionRequired: false, practiceNeeded: 1, challengeCn: 8, canAdvance: false, highest: false,
  })
  assert.deepEqual(professionProgress(character({ ...profession, rank: 6 }), 'p'), {
    rank: 6, rankName: 'Legendary', nextRankName: null, challengesNeeded: 8,
    missionRequired: true, practiceNeeded: 49, challengeCn: 14, canAdvance: false, highest: false,
  })
  assert.deepEqual(professionProgress(character({ ...profession, rank: 7 }), 'p'), {
    rank: 7, rankName: 'Legendary', nextRankName: null, challengesNeeded: 0,
    missionRequired: false, practiceNeeded: 0, challengeCn: 15, canAdvance: false, highest: true,
  })
})

test('advance needs challenges, required mission and practice, then resets counters', () => {
  let c = character()
  assert.throws(() => apply(c, 'profession:advance'), { code: 'not_ready' })
  for (let i = 0; i < 5; i++) c = apply(c, 'profession:challenge')
  for (let i = 0; i < 8; i++) c = apply(c, 'profession:practice')
  assert.throws(() => apply(c, 'profession:advance'), { code: 'not_ready' })
  c = apply(c, 'profession:mission', { done: true })
  assert.equal(professionProgress(c, 'p').canAdvance, true)
  const previous = c.professions[0]
  const next = apply(c, 'profession:advance')
  assert.deepEqual(next.professions[0], { ...profession, rank: 3 })
  assert.equal(c.professions[0], previous)
  assert.throws(() => apply(character({ ...profession, rank: 7 }), 'profession:advance'), { code: 'not_ready' })
})

test('rank 0 to 1 needs no mission and missing profession is refused', () => {
  let c = character({ ...profession, rank: 0 })
  for (let i = 0; i < 2; i++) c = apply(c, 'profession:challenge')
  c = apply(c, 'profession:practice')
  assert.equal(apply(c, 'profession:advance').professions[0]?.rank, 1)
  assert.throws(() => apply(makeCharacter(), 'profession:challenge'), { code: 'not_found' })
  assert.throws(() => professionProgress(makeCharacter(), 'p'), RuleError)
})

test('mission tick clears, preserving untouched professions', () => {
  const other: Profession = { ...profession, id: 'other' }
  const c = makeCharacter({ professions: [profession, other] })
  const ticked = apply(c, 'profession:mission', { done: true })
  assert.equal(ticked.professions[0]?.missions, 1)
  assert.equal(ticked.professions[1], other)
  assert.equal(apply(ticked, 'profession:mission', { done: false }).professions[0]?.missions, 0)
})
