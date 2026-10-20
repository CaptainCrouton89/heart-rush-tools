import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCharacter, type BuilderInput } from '@heartrush/rules-engine/create'
import type { PlayChoice } from '@heartrush/rules-engine/catalogue'
import { getCatalogue, PATHS, PATHS_BY_ID, rulebookUrl, raceImageUrl, resolveRef } from '../src/catalogue'
import { racesFileSchema } from '../src/catalogue/schema'
import racesJson from '@heartrush/content/play/races' with { type: 'json' }

const cat = getCatalogue()
const raceByTitle = (title: string) => {
  const race = [...cat.races.values()].find((r) => r.title === title)
  assert.ok(race, `race ${title} is in the catalogue`)
  return race
}

test('parses the real compiler output: three non-empty catalogues with a content version', () => {
  assert.ok(cat.contentVersion.length > 0)
  assert.ok(cat.talents.size > 0 && cat.races.size > 0 && cat.conditions.size > 0)
  assert.equal(getCatalogue(), cat, 'parsed once')
})

test('Centaur resolves Thundering Charge (major) and Hoof Strike (passive)', () => {
  const centaur = cat.races.get('player.kin-culture.centaur')
  assert.ok(centaur)
  assert.deepEqual(
    centaur.abilities.map((a) => [a.title, a.frequency]),
    [['Thundering Charge', 'major'], ['Hoof Strike', 'passive']],
  )
})

test('player.conditions~restrained resolves', () => {
  const restrained = cat.conditions.get('player.conditions~restrained')
  assert.ok(restrained)
  assert.equal(restrained.title, 'Restrained')
})

test("Gnome's Whiteling subrace carries its effects", () => {
  const whiteling = raceByTitle('Gnome').subraces.find((s) => s.title.startsWith('Whiteling'))
  assert.ok(whiteling)
  assert.equal(whiteling.baseMaxHp, 30)
  assert.deepEqual(whiteling.effects, [
    { kind: 'cost', purchase: 'hp', delta: 1 },
    { kind: 'dieCap', ability: 'might', max: 6 },
  ])
})

test('Shontobi: the path choice resolves two options', () => {
  const shontobi = raceByTitle('Human').subraces.find((s) => s.title.startsWith('Shontobi'))
  assert.ok(shontobi)
  const path = shontobi.choices.find((c) => c.id === 'path')
  assert.ok(path && path.kind === 'options')
  assert.deepEqual(path.options.map((o) => o.id), ['eagle-companion', 'honor-bound'])
  assert.equal(path.options[0]!.abilities[0]!.grants?.talentId, 'player.talents.beast-companion')
  assert.deepEqual(path.options[1]!.effects, [{ kind: 'cost', purchase: 'aspect:rank', delta: -1, where: { honor: true } }])
})

test('Amverela: the expertise choice resolves two options with effects', () => {
  const amverela = raceByTitle('Elf').subraces.find((s) => s.title.startsWith('Amverela'))
  assert.ok(amverela)
  const expertise = amverela.choices.find((c) => c.id === 'expertise')
  assert.ok(expertise && expertise.kind === 'options')
  assert.deepEqual(expertise.options.map((o) => o.id), ['martial', 'cognitive'])
  for (const option of expertise.options) {
    assert.ok(option.effects.length > 0, `${option.id} has effects`)
    assert.ok(option.effects.every((e) => e.kind === 'cost' && e.delta === -2))
  }
})

test("Oracle's Burden grants the oracle talent with its destiny level", () => {
  const burden = raceByTitle('Gnome').subraces.flatMap((s) => s.abilities).concat(raceByTitle('Gnome').abilities)
    .find((a) => a.title === "Oracle's Burden")
  assert.ok(burden)
  assert.deepEqual(burden.grants, { talentId: 'player.talents.oracle', destiny: true })
})

test('every grant, choice talent id and catalogue path resolves (INV-CATREF)', () => {
  for (const race of cat.races.values()) {
    const abilities = [
      ...race.abilities,
      ...race.choices.flatMap((c) => (c.kind === 'options' ? c.options.flatMap((o) => o.abilities) : [])),
      ...race.subraces.flatMap((s) => [...s.abilities, ...s.choices.flatMap((c) => (c.kind === 'options' ? c.options.flatMap((o) => o.abilities) : []))]),
    ]
    for (const a of abilities) if (a.grants) assert.ok(cat.talents.has(a.grants.talentId), `${race.title}: ${a.grants.talentId}`)
  }
})

test('resolveRef falls back to the snapshot when the id is gone or null', () => {
  const ok = resolveRef(cat.talents, { catalogueId: 'player.talents.oracle', titleSnapshot: 'Old name' })
  assert.equal(ok.unresolved, false)
  assert.equal(ok.title, cat.talents.get('player.talents.oracle')!.title)
  const gone = resolveRef(cat.talents, { catalogueId: 'player.talents.removed', titleSnapshot: 'Removed' })
  assert.deepEqual([gone.entry, gone.title, gone.unresolved], [null, 'Removed', true])
  assert.equal(resolveRef(cat.talents, { catalogueId: null, titleSnapshot: 'Custom' }).unresolved, true)
})

test('rules-site links: race image and rulebook path', () => {
  assert.equal(rulebookUrl('/player/conditions#dazed'), 'https://rules.heartrush.party/player/conditions#dazed')
  assert.equal(raceImageUrl({ image: null }), null)
  const withImage = [...cat.races.values()].find((r) => r.image)
  assert.ok(withImage)
  assert.equal(raceImageUrl(withImage), `https://rules.heartrush.party${withImage.image}`)
})

test('the five paths of Paths.md', () => {
  assert.deepEqual(PATHS.map((p) => p.id), ['vampire', 'lycanthrope', 'syncopath', 'physiarch', 'beastheart'])
  assert.equal(PATHS_BY_ID.get('syncopath')!.path, '/player/paths#syncopath')
})

test('a schema mismatch throws', () => {
  assert.throws(() => racesFileSchema.parse({ ...racesJson, schemaVersion: 2 }))
  const broken = structuredClone(racesJson) as { entries: Array<{ abilities: Array<{ grants?: unknown }> }> }
  delete broken.entries[0]!.abilities[0]!.grants
  assert.throws(() => racesFileSchema.parse(broken))
})

/** First valid answer to every choice, so `createCharacter` can run on any race. */
function answer(choice: PlayChoice): string {
  if (choice.kind === 'options') return choice.options[0]!.id
  const talent = [...cat.talents.values()].find((t) => choice.tradition === null || t.tradition === choice.tradition)
  assert.ok(talent, `a talent for choice ${choice.id}`)
  return talent.id
}

test('the engine builds a character from every real race and subrace', () => {
  let built = 0
  for (const race of cat.races.values()) {
    for (const subrace of race.subraces.length ? race.subraces : [null]) {
      const choices = [...race.choices, ...(subrace?.choices ?? [])]
      const input: BuilderInput = {
        id: 'C1', at: '2026-01-01T00:00:00.000Z', name: 'Test', pronouns: '', dream: '', description: '', motivation: '', portrait: null,
        raceId: race.id, subraceId: subrace?.id ?? null,
        kinChoices: Object.fromEntries(choices.map((c) => [c.id, answer(c)])),
        dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
        ageCategory: 'adult', ageBenefits: [], createdAspects: ['One', 'Two'],
        professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel: 1,
      }
      const character = createCharacter(input, cat)
      assert.equal(character.kin.raceId, race.id)
      assert.deepEqual(Object.keys(character.kin.choices).sort(), choices.map((c) => c.id).sort(), `${race.title}/${subrace?.title}`)
      built++
    }
  }
  assert.ok(built >= cat.races.size)
})

test('the engine applies a real grant, a real choice option and a real subrace base HP', () => {
  const base = (raceId: string, subraceId: string | null, kinChoices: Record<string, string>): BuilderInput => ({
    id: 'C2', at: '2026-01-01T00:00:00.000Z', name: 'Test', pronouns: '', dream: '', description: '', motivation: '', portrait: null,
    raceId, subraceId, kinChoices, dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
    ageCategory: 'adult', ageBenefits: [], createdAspects: ['One', 'Two'], professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel: 1,
  })
  const gnome = raceByTitle('Gnome')
  const whiteling = gnome.subraces.find((s) => s.title.startsWith('Whiteling'))!
  const c = createCharacter(base(gnome.id, whiteling.id, {}), cat)
  assert.equal(c.hp.baseMax, 30)
  assert.ok(c.talents.some((t) => t.catalogueId === 'player.talents.oracle' && t.destiny))
  const nuun = raceByTitle('Human').subraces.find((s) => s.title === 'Nuun')!
  const fire = createCharacter(base('player.kin-culture.human', nuun.id, { 'resilience-talent': 'player.talents.action-surge', element: 'fire' }), cat)
  assert.deepEqual(fire.attunements.map((a) => [a.element, a.level, a.source]), [['fire', 'basic', 'race']])
  assert.deepEqual(fire.kin.choices, { 'resilience-talent': 'player.talents.action-surge', element: 'fire' })
})
