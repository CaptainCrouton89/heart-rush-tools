import assert from 'node:assert/strict'
import { test } from 'node:test'
import { objectiveCn, type Stratagem } from '../src/stratagem'

const stratagem: Stratagem = {
  goal: 'Take Thornwall', timePerRoll: '1 week', setupCn: 12, status: 'active', position: 0,
  objectives: [
    { title: 'Cut the supply road', cn: null, leader: null, state: 'open' },
    { title: '', cn: 9, leader: null, state: 'open' },
  ],
  assets: [{ name: 'Bad weather', kind: 'hindrance' }],
}

test('6: setup CN 12 + hindrance 3 = 15; asset cancels it to 12; own CN 9 stays 9', () => {
  assert.equal(objectiveCn(stratagem, 0), 15)
  const withAsset = { ...stratagem, assets: [...stratagem.assets, { name: 'A guide', kind: 'asset' as const }] }
  assert.equal(objectiveCn(withAsset, 0), 12)
  assert.equal(objectiveCn(withAsset, 1), 9)
  assert.equal(objectiveCn({ ...stratagem, assets: Array.from({ length: 6 }, (_, i) => ({ name: String(i), kind: 'asset' as const })) }, 0), -6)
  assert.equal(objectiveCn(stratagem, 0), 15)
})

test('6: missing objective is refused', () => {
  assert.throws(() => objectiveCn(stratagem, 2), RangeError)
})
