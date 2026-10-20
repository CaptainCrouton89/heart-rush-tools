import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ulid } from 'ulid'
import { CrouterError } from '@north-light/sdk'
import type { BuilderInput, ClientAction } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../src/catalogue'
import { applyCharacterAction, createDraft, finishDraft, saveDraft, type CharacterDoc, type CharacterResult } from '../src/server/characters'
import { runAi, type AiDeps, type AiOutcome, type AiRequest, type AiRuntime, type SuggestValue } from '../src/server/ai'
import { GOOD_ASPECT_GUIDANCE, offeredTalents } from '../src/server/ai-prompts'
import { createFakeDirectory, makeAuth, signIn } from '../../../packages/northlight/test/fake-directory'
import { openPlayDbs, type D1 } from './db'

let t: Awaited<ReturnType<typeof openPlayDbs>>
let db: D1
before(async () => {
  t = await openPlayDbs()
  db = t.DB
})
after(() => t.dispose())
beforeEach(async () => {
  await db.prepare('DELETE FROM campaign').run()
  await db.prepare('DELETE FROM character').run()
  await db.prepare('DELETE FROM user').run()
  for (const id of ['owner', 'gm', 'player', 'stranger']) await db.prepare('INSERT INTO user (id, display_name) VALUES (?, ?)').bind(id, id).run()
  await db.prepare("INSERT INTO campaign (id, name, gm_user_id) VALUES ('camp', 'The Table', 'gm')").run()
  for (const [user, role] of [['gm', 'gm'], ['owner', 'player'], ['player', 'player']]) {
    await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('camp', user, role).run()
  }
})

// ---- Fixtures --------------------------------------------------------------------------------------------

const cat = getCatalogue()
const CENTAUR = [...cat.races.values()].find((r) => r.title === 'Centaur')!
const at = () => new Date().toISOString()
function builder(overrides: Partial<BuilderInput> = {}): BuilderInput {
  return {
    id: ulid(), at: at(), name: 'Ysolde', pronouns: 'she/her', dream: 'To see the sea', description: '', motivation: '', portrait: null,
    raceId: CENTAUR.id, subraceId: null, kinChoices: {},
    dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
    ageCategory: 'adult', ageBenefits: [], createdAspects: ['Loyal to a fault', 'Stubborn as a mule'],
    professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel: 1,
    ...overrides,
  }
}
const award = (amount: number): ClientAction => ({ kind: 'xp:award', amount, id: ulid(), at: at() })
const warcaster = (element: string): ClientAction =>
  ({ kind: 'bloodmark:pick', ability: { kind: 'specialization', title: 'Warcaster', text: 'Elemental talents cost less.', element }, id: ulid(), at: at() })

function ok(r: CharacterResult): CharacterDoc {
  assert.ok(r.ok, JSON.stringify(r.ok ? null : { ...r, character: undefined }))
  return r.character
}

/** A character of `owner` with the given pending actions, finished unless `draft`. */
async function make(opts: { owner?: string; campaign?: string | null; draft?: boolean; pending?: ClientAction[]; level?: number } = {}): Promise<CharacterDoc> {
  const owner = opts.owner ?? 'owner'
  const created = ok(await createDraft(db, owner, { builder: builder({ bloodmarkLevel: opts.level ?? 1 }) }))
  const saved = ok(await saveDraft(db, owner, { characterId: created.id, revision: 1, builder: (created.state as { builder: BuilderInput }).builder, pending: opts.pending ?? [] }))
  const doc = opts.draft ? saved : ok(await finishDraft(db, owner, { characterId: saved.id, revision: saved.revision }))
  if (opts.campaign !== null && opts.campaign !== undefined) await db.prepare('UPDATE character SET campaign_id = ? WHERE id = ?').bind(opts.campaign, doc.id).run()
  return doc
}

type Call = { params: Record<string, unknown>; options: Record<string, unknown> }
/** A stub runtime. `answer` is the `runs.parse` outcome; `calls` records every call. */
function stub(answer: (call: Call) => unknown | Promise<unknown>) {
  const calls: Call[] = []
  const runtime: AiRuntime = {
    runs: {
      parse: async (params: Record<string, unknown>, options: Record<string, unknown>) => {
        const call = { params, options }
        calls.push(call)
        return answer(call)
      },
    } as unknown as AiRuntime['runs'],
  }
  const runtimeFor: string[] = []
  const deps: AiDeps = { db, runtimeFor: async (userId) => (runtimeFor.push(userId), runtime) }
  return { deps, calls, runtimeFor }
}
const result = (value: unknown) => ({ kind: 'result', reason: 'finalized', output_parsed: value })
const failure = (reason: string) => ({ kind: 'failure', reason, declined: null, output_parsed: null })

const promptOf = (calls: Call[]) => calls[0].params.prompt as string

/** Counts of every table an AI call must leave alone. */
async function snapshot() {
  const n = async (sql: string) => (await db.prepare(sql).first<{ n: number }>())!.n
  return {
    events: await n('SELECT COUNT(*) AS n FROM character_event'),
    revisions: await n('SELECT COALESCE(SUM(revision), 0) AS n FROM character'),
    updated: JSON.stringify((await db.prepare('SELECT id, state, updated_at FROM character ORDER BY id').all()).results),
    journal: await n('SELECT COUNT(*) AS n FROM journal_entry'),
  }
}

const EXPLAIN: AiRequest = { feature: 'explain', characterId: '', input: { talentId: '' } }

function refused(outcome: AiOutcome, status: number, code: string) {
  assert.equal(outcome.kind, 'refused', JSON.stringify(outcome))
  if (outcome.kind === 'refused') {
    assert.equal(outcome.status, status)
    assert.equal(outcome.code, code)
  }
}

// ---- Authorization comes first ---------------------------------------------------------------------------

test('every refusal starts no run, touches no runtime, and writes nothing', async () => {
  const mine = await make({ campaign: 'camp' })
  const draft = await make({ draft: true })
  const talentId = mine.state.draft ? '' : mine.state.talents[0].id
  const s = stub(() => result({}))
  const before = await snapshot()
  const cases: Array<[string, AiRequest, string, number, string]> = [
    ['explain: a stranger cannot read the character', { feature: 'explain', characterId: mine.id, input: { talentId } }, 'stranger', 403, 'forbidden'],
    ['explainAspect: a stranger', { feature: 'explainAspect', characterId: mine.id, input: { aspectId: 'x' } }, 'stranger', 403, 'forbidden'],
    ['suggest: a stranger', { feature: 'suggest', characterId: mine.id }, 'stranger', 403, 'forbidden'],
    ['explain: a campaign member cannot see a draft', { feature: 'explain', characterId: draft.id, input: { talentId } }, 'player', 403, 'forbidden'],
    ['suggest: the GM cannot see a draft', { feature: 'suggest', characterId: draft.id }, 'gm', 403, 'forbidden'],
    ['gmAssistant: a campaign player', { feature: 'gmAssistant', campaignId: 'camp', input: { question: 'Who is hurt?' } }, 'player', 403, 'forbidden'],
    ['gmAssistant: the character\'s own owner is a player', { feature: 'gmAssistant', campaignId: 'camp', input: { question: 'Who is hurt?' } }, 'owner', 403, 'forbidden'],
    ['gmAssistant: an unrelated account', { feature: 'gmAssistant', campaignId: 'camp', input: { question: 'Who is hurt?' } }, 'stranger', 403, 'forbidden'],
    ['gmAssistant: no such campaign is 403 for a non-member too', { feature: 'gmAssistant', campaignId: 'nope', input: { question: 'Who is hurt?' } }, 'gm', 403, 'forbidden'],
    ['an unknown feature', { feature: 'narrate', characterId: mine.id } as unknown as AiRequest, 'owner', 403, 'forbidden'],
    ['no such character', { feature: 'suggest', characterId: 'nope' }, 'owner', 404, 'not_found'],
    ['explain: no talentId', { feature: 'explain', characterId: mine.id, input: {} as { talentId: string } }, 'owner', 400, 'bad_input'],
    ['explain: a talent the character does not have and the rulebook lacks', { feature: 'explain', characterId: mine.id, input: { talentId: 'player.talents.nope' } }, 'owner', 404, 'not_found'],
    ['explainAspect: no such aspect', { feature: 'explainAspect', characterId: mine.id, input: { aspectId: 'nope' } }, 'owner', 404, 'not_found'],
    ['gmAssistant: an empty question', { feature: 'gmAssistant', campaignId: 'camp', input: { question: '  ' } }, 'gm', 400, 'bad_input'],
  ]
  for (const [name, request, userId, status, code] of cases) {
    try {
      refused(await runAi(s.deps, userId, request), status, code)
    } catch (error) {
      throw new Error(`${name}: ${error instanceof Error ? error.message : error}`)
    }
  }
  assert.equal(s.calls.length, 0, 'no run was started')
  assert.equal(s.runtimeFor.length, 0, 'the runtime was never asked for')
  assert.deepEqual(await snapshot(), before)
})

test('read access is enough: a campaign player and the GM may explain and suggest on a finished campaign character', async () => {
  const mine = await make({ campaign: 'camp' })
  for (const userId of ['owner', 'player', 'gm']) {
    const s = stub(() => result({ suggestions: [] }))
    const out = await runAi(s.deps, userId, { feature: 'suggest', characterId: mine.id })
    assert.equal(out.kind, 'result', `${userId}: ${JSON.stringify(out)}`)
  }
})

// ---- Explain ---------------------------------------------------------------------------------------------

test('explain: the prompt carries the ability text and the character from the stored document; the run uses the contract options', async () => {
  const doc = await make({ campaign: 'camp' })
  assert.ok(!doc.state.draft)
  const racial = doc.state.talents.find((x) => x.titleSnapshot === 'Hoof Strike')!
  const value = { summary: 's', whenToUse: 'w', cost: 'c', example: 'e' }
  const controller = new AbortController()
  const s = stub(() => result(value))
  const out = await runAi(s.deps, 'owner', { feature: 'explain', characterId: doc.id, input: { talentId: racial.id } }, controller.signal)
  assert.deepEqual(out, { kind: 'result', value })
  assert.equal(s.calls.length, 1)
  assert.deepEqual(s.runtimeFor, ['owner'])
  const { params, options } = s.calls[0]
  assert.deepEqual(params.scopes, ['crtr:llm', 'crtr:act'])
  assert.equal(params.deadline, '60s')
  assert.ok(params.output_schema && typeof (params.output_schema as { toJSONSchema?: unknown }).toJSONSchema === 'function')
  assert.equal(options.signal, controller.signal)
  const prompt = promptOf(s.calls)
  assert.match(prompt, /Hoof Strike/)
  assert.match(prompt, /Rules text: .+/)
  assert.match(prompt, /The character: Ysolde, abilities might d6, agility d6, cunning d4, presence d4, heart die d8/)
  assert.match(prompt, /Do not invent rules not in the text\. Under 120 words\./)
})

test('explain: a catalogue talent the character does not own is explained from the rulebook text', async () => {
  const doc = await make()
  const entry = [...cat.talents.values()].find((x) => x.category === 'combat')!
  const s = stub(() => result({ summary: 's', whenToUse: 'w', cost: 'c', example: 'e' }))
  const out = await runAi(s.deps, 'owner', { feature: 'explain', characterId: doc.id, input: { talentId: entry.id } })
  assert.equal(out.kind, 'result')
  assert.ok(promptOf(s.calls).includes(entry.body))
})

test('explain on a draft builds the prompt from previewDraft of the stored draft (ruling 13)', async () => {
  const draft = await make({ draft: true })
  assert.ok(draft.state.draft)
  // The step-2 row: the racial talent's id is deterministic from the builder id (ruling 6), so it exists before Finish.
  const racialId = `${draft.state.builder.id}:${[...Array(40).keys()].find(() => true)}`
  const s0 = stub(() => result({ summary: 's', whenToUse: 'w', cost: 'c', example: 'e' }))
  // Find the real id by finishing a copy of the same builder in memory: previewDraft is what runAi uses.
  const { previewDraft } = await import('@heartrush/rules-engine/draft')
  const preview = previewDraft(draft.state, cat).character
  const hoof = preview.talents.find((x) => x.titleSnapshot === 'Hoof Strike')!
  assert.notEqual(hoof.id, racialId)
  const out = await runAi(s0.deps, 'owner', { feature: 'explain', characterId: draft.id, input: { talentId: hoof.id } })
  assert.equal(out.kind, 'result', JSON.stringify(out))
  assert.match(promptOf(s0.calls), /Hoof Strike/)
  assert.match(promptOf(s0.calls), /The character: Ysolde,/)
  // The draft row is untouched.
  const row = await db.prepare('SELECT revision FROM character WHERE id = ?').bind(draft.id).first<{ revision: number }>()
  assert.equal(row!.revision, draft.revision)
})

// ---- Explain this aspect (ruling 14) ---------------------------------------------------------------------

test('explainAspect: the prompt has the guidance, the aspect, kin, dream and the other aspects; works on a draft', async () => {
  const draft = await make({ draft: true })
  assert.ok(draft.state.draft)
  const { previewDraft } = await import('@heartrush/rules-engine/draft')
  const aspect = previewDraft(draft.state, cat).character.aspects.find((a) => a.text === 'Loyal to a fault')!
  const value = { summary: 's', helps: 'h', hurts: 'x', example: 'e' }
  const s = stub(() => result(value))
  const out = await runAi(s.deps, 'owner', { feature: 'explainAspect', characterId: draft.id, input: { aspectId: aspect.id } })
  assert.deepEqual(out, { kind: 'result', value })
  const prompt = promptOf(s.calls)
  assert.ok(prompt.includes(GOOD_ASPECT_GUIDANCE))
  assert.match(prompt, /The aspect: "Loyal to a fault"/)
  assert.match(prompt, /kin Centaur, dream "To see the sea"/)
  assert.match(prompt, /other aspects .*"Stubborn as a mule"/)
  assert.ok(!/other aspects .*"Loyal to a fault"/.test(prompt), 'the aspect itself is not listed among the others')
  assert.match(prompt, /Under 120 words/)
})

test('the aspect guidance in the prompt is still the rulebook section', () => {
  const book = readFileSync(fileURLToPath(new URL('../../../heart_rush/all_sections_formatted/Building_Your_Character.md', import.meta.url)), 'utf8')
  const section = book.split('#### What Makes a Good Aspect')[1].split('#### Interconnected Aspects')[0].trim()
  assert.equal(GOOD_ASPECT_GUIDANCE, section)
})

// ---- Suggest ---------------------------------------------------------------------------------------------

test('suggest: only affordable, unowned, attuned talents are listed; unknown, unlisted and repeated ids are dropped', async () => {
  const doc = await make({ pending: [award(8)] })
  assert.ok(!doc.state.draft)
  const owned = cat.talents.get([...cat.talents.values()].find((x) => x.category === 'combat')!.id)!
  const bought = ok(await applyCharacterAction(db, 'owner', {
    characterId: doc.id, revision: doc.revision,
    action: { kind: 'xp:buy', purchase: 'talent:combat', talent: { catalogueId: owned.id }, id: ulid(), at: at() },
  }))
  assert.ok(!bought.state.draft)
  const remaining = bought.derived!.xp.remaining
  const s = stub(() => result({ suggestions: [] }))
  await runAi(s.deps, 'owner', { feature: 'suggest', characterId: bought.id })
  const prompt = promptOf(s.calls)
  const listed = prompt.split('\n').filter((l) => l.startsWith('player.')).map((l) => l.split(' | '))
  assert.ok(listed.length > 0)
  const ids = new Set(listed.map((l) => l[0]))
  assert.ok(!ids.has(owned.id), 'an owned talent is not offered')
  assert.ok(![...ids].some((id) => cat.talents.get(id)!.category === 'elemental'), 'no elemental talent without an attunement')
  for (const l of listed) assert.ok(Number(l[3]) <= remaining, `${l[1]} costs ${l[3]} with ${remaining} XP left`)
  const dear = [...cat.talents.values()].find((x) => x.category !== 'elemental' && x.id !== owned.id && !ids.has(x.id))
  if (dear) assert.ok(!prompt.includes(dear.id), 'a talent above the remaining XP is not offered')
  assert.match(prompt, new RegExp(`remaining XP ${remaining}`))

  const [a, b] = [listed[0][0], listed[1][0]]
  const s2 = stub(() => result({ suggestions: [
    { talentId: a, reason: 'fits' }, { talentId: 'player.talents.invented', reason: 'made up' },
    { talentId: owned.id, reason: 'already owned' }, { talentId: a, reason: 'again' }, { talentId: b, reason: 'also fits' },
  ] }))
  const out = await runAi(s2.deps, 'owner', { feature: 'suggest', characterId: bought.id })
  assert.equal(out.kind, 'result')
  const value = (out as { value: SuggestValue }).value
  assert.deepEqual(value.suggestions.map((x) => [x.talentId, x.reason]), [[a, 'fits'], [b, 'also fits']])
  assert.equal(value.suggestions[0].price, Number(listed[0][3]))
  assert.equal(value.suggestions[0].title, cat.talents.get(a)!.title)
  assert.equal(value.suggestions[0].rulebookUrl, `https://rules.heartrush.party${cat.talents.get(a)!.path}`)
})

test('suggest: elemental talents are listed for an attuned character, a Warcaster is attuned through its grant', async () => {
  const plain = await make({ pending: [award(40)] })
  const caster = await make({ level: 2, pending: [warcaster('fire'), award(40)] })
  assert.ok(!plain.state.draft && !caster.state.draft)
  assert.deepEqual(caster.state.attunements.map((x) => x.element), ['fire'])
  assert.equal(offeredTalents(plain.state, cat.talents.values()).filter((o) => o.talent.category === 'elemental').length, 0)
  const offered = offeredTalents(caster.state, cat.talents.values()).filter((o) => o.talent.category === 'elemental')
  assert.ok(offered.length > 0)
  assert.ok(offered.every((o) => o.talent.elements.some((e) => e.toLowerCase() === 'fire')), 'only fire talents')
  const s = stub(() => result({ suggestions: [] }))
  await runAi(s.deps, 'owner', { feature: 'suggest', characterId: caster.id })
  assert.ok(promptOf(s.calls).includes(offered[0].talent.id))
  assert.match(promptOf(s.calls), /elemental/)
})

test('suggest: a character with nothing affordable gets no suggestions and no run', async () => {
  const doc = await make()
  await db.prepare("UPDATE character SET state = json_set(state, '$.xp.awarded', 0) WHERE id = ?").bind(doc.id).run()
  const s = stub(() => result({ suggestions: [] }))
  assert.deepEqual(await runAi(s.deps, 'owner', { feature: 'suggest', characterId: doc.id }), { kind: 'result', value: { suggestions: [] } })
  assert.equal(s.calls.length, 0)
})

// ---- GM assistant ----------------------------------------------------------------------------------------

test('gmAssistant: the GM gets every finished campaign character in the prompt, never a draft or a journal entry', async () => {
  const a = await make({ owner: 'owner', campaign: 'camp' })
  await make({ owner: 'player', campaign: 'camp' })
  const draft = await make({ owner: 'player', campaign: 'camp', draft: true })
  await db.prepare('INSERT INTO journal_entry (id, character_id, author_user_id, body, shared) VALUES (?, ?, ?, ?, ?)').bind('j1', a.id, 'owner', 'SECRET diary text', 0).run()
  const value = { answer: 'a', perCharacter: [{ characterName: 'Ysolde', note: 'n' }], rulesCited: ['Combat'] }
  const s = stub(() => result(value))
  const out = await runAi(s.deps, 'gm', { feature: 'gmAssistant', campaignId: 'camp', input: { question: 'Who is closest to going down?' } })
  assert.deepEqual(out, { kind: 'result', value })
  const prompt = promptOf(s.calls)
  assert.equal(prompt.match(/### Ysolde/g)!.length, 2)
  assert.match(prompt, /HP: \d+ \/ \d+ effective max/)
  assert.match(prompt, /Question: Who is closest to going down\?/)
  assert.ok(!prompt.includes('SECRET'))
  assert.ok(!prompt.includes(draft.id))
  assert.deepEqual(s.calls[0].params.scopes, ['crtr:llm', 'crtr:act'])
})

// ---- How a run ends --------------------------------------------------------------------------------------

test('outcomes map to result | failed{declined, deadline_exceeded, runtime_error, not_connected}', async () => {
  const doc = await make()
  const talentId = doc.state.draft ? '' : doc.state.talents[0].id
  const req: AiRequest = { feature: 'explain', characterId: doc.id, input: { talentId } }
  const run = async (answer: () => unknown) => runAi(stub(answer).deps, 'owner', req)
  assert.deepEqual(await run(() => failure('declined')), { kind: 'failed', reason: 'declined' })
  assert.deepEqual(await run(() => failure('deadline_exceeded')), { kind: 'failed', reason: 'deadline_exceeded' })
  assert.deepEqual(await run(() => failure('crashed')), { kind: 'failed', reason: 'runtime_error' })
  assert.deepEqual(await run(() => { throw Object.assign(new Error('late'), { code: 'deadline_exceeded' }) }), { kind: 'failed', reason: 'deadline_exceeded' })
  assert.deepEqual(await run(() => { throw new Error('boom') }), { kind: 'failed', reason: 'runtime_error' })
  assert.deepEqual(await run(() => result({ summary: 'only this' })), { kind: 'failed', reason: 'runtime_error' }, 'a result that does not match the schema')
  const noConnection = { runtimeFor: async () => { throw new CrouterError('no connection', 'not_connected') } }
  assert.deepEqual(await runAi({ db, ...noConnection }, 'owner', req), { kind: 'failed', reason: 'not_connected' })
})

test('a paused refusal from the directory: the next AI call is not_connected (ruling 18), and a removed one too', async () => {
  for (const code of ['grant_suspended', 'grant_removed']) {
    await db.prepare('DELETE FROM connection').run()
    await t.AUTH_DB.prepare('DELETE FROM session').run()
    const dir = await createFakeDirectory()
    const auth = makeAuth(db, dir, { sessionDb: t.AUTH_DB, scopes: ['openid', 'profile', 'email', 'crtr:llm', 'crtr:act'] })
    await signIn(auth, dir, { userId: 'owner', name: 'owner' })
    await db.prepare("UPDATE connection SET access_token_expires_at = '2000-01-01T00:00:00.000Z'").run()
    dir.refuseRefresh(code)
    const doc = await make()
    const talentId = doc.state.draft ? '' : doc.state.talents[0].id
    const out = await runAi({ db, runtimeFor: (id) => auth.runtimeFor(id) }, 'owner', { feature: 'explain', characterId: doc.id, input: { talentId } })
    assert.deepEqual(out, { kind: 'failed', reason: 'not_connected' }, code)
    // The characters stay; the next call, with no connection left, is still not_connected.
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM character WHERE id = ?').bind(doc.id).first<{ n: number }>())!.n, 1)
    assert.deepEqual(await runAi({ db, runtimeFor: (id) => auth.runtimeFor(id) }, 'owner', { feature: 'explain', characterId: doc.id, input: { talentId } }), { kind: 'failed', reason: 'not_connected' })
  }
})

// ---- INV-AI ----------------------------------------------------------------------------------------------

test('a successful run of every feature writes nothing: no event, no revision change, no updated row', async () => {
  const doc = await make({ campaign: 'camp', pending: [award(10)] })
  assert.ok(!doc.state.draft)
  const aspectId = doc.state.aspects[0].id
  const talentId = doc.state.talents[0].id
  const before = await snapshot()
  const answers: Array<[AiRequest, string, unknown]> = [
    [{ feature: 'explain', characterId: doc.id, input: { talentId } }, 'owner', { summary: 's', whenToUse: 'w', cost: 'c', example: 'e' }],
    [{ feature: 'explainAspect', characterId: doc.id, input: { aspectId } }, 'owner', { summary: 's', helps: 'h', hurts: 'x', example: 'e' }],
    [{ feature: 'suggest', characterId: doc.id }, 'owner', { suggestions: [] }],
    [{ feature: 'gmAssistant', campaignId: 'camp', input: { question: 'Anything?' } }, 'gm', { answer: 'a', perCharacter: [], rulesCited: [] }],
  ]
  for (const [request, userId, value] of answers) {
    const s = stub(() => result(value))
    const out = await runAi(s.deps, userId, request)
    assert.equal(out.kind, 'result', JSON.stringify(out))
  }
  assert.deepEqual(await snapshot(), before)
})
