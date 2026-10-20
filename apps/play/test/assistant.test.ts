// The creation assistant's server (design acceptance 3, 6, 9, 10, 11, 12 node parts): the chat row, the run lifecycle with a fake
// runtime, the authorization query, the prompt and the Finish archive.
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ulid } from 'ulid'
import { CrouterError, NotFoundError } from '@north-light/sdk'
import type { BuilderInput } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../src/catalogue'
import { createDraft, finishDraft, saveDraft, type CharacterDoc, type CharacterResult } from '../src/server/characters'
import { getChat, sendChat, stopChat, type AssistantDeps, type ChatState } from '../src/server/assistant'
import { assistantPrompt } from '../src/server/assistant-prompt'
import { turnSchema, type Turn } from '../src/assistant/schema'
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
  for (const id of ['owner', 'gm', 'stranger']) await db.prepare('INSERT INTO user (id, display_name) VALUES (?, ?)').bind(id, id).run()
  await db.prepare("INSERT INTO campaign (id, name, gm_user_id) VALUES ('camp', 'The Table', 'gm')").run()
  for (const [user, role] of [['gm', 'gm'], ['owner', 'player']]) await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('camp', user, role).run()
})

// ---- Fixtures ---------------------------------------------------------------------------------------

const cat = getCatalogue()
const CENTAUR = [...cat.races.values()].find((r) => r.title === 'Centaur')!
const at = () => new Date().toISOString()
function builder(overrides: Partial<BuilderInput> = {}): BuilderInput {
  return {
    id: ulid(), at: at(), name: 'Ysolde', pronouns: 'she/her', dream: 'To see the sea', description: '', motivation: '', portrait: null,
    raceId: '', subraceId: null, kinChoices: {},
    dice: {} as BuilderInput['dice'],
    ageCategory: 'adult', ageBenefits: [], createdAspects: ['Loyal to a fault', 'Stubborn as a mule'],
    professions: [], bloodmarkLevel: 0,
    ...overrides,
  }
}
function ok(r: CharacterResult): CharacterDoc {
  assert.ok(r.ok, JSON.stringify(r.ok ? null : { ...r, character: undefined }))
  return r.character
}
const draftOf = async (owner = 'owner', overrides: Partial<BuilderInput> = {}) => ok(await createDraft(db, owner, { builder: builder(overrides) }))

type Run = { run_id: string; status: 'running' | 'settled' | 'idle'; outcome?: { kind: string; reason?: string }; result?: unknown; metadata?: Record<string, unknown> }
/** A runtime whose runs the test controls: `runs` is every run started, in order; `settle(i, ...)` ends one. */
function fake() {
  const runs: Run[] = []
  const calls = { start: [] as Record<string, unknown>[], cancel: [] as string[], runtimeFor: [] as string[] }
  const runtime = {
    runs: {
      start: async (params: Record<string, unknown>, options: Record<string, unknown>) => {
        calls.start.push({ params, options })
        const run: Run = { run_id: `run-${runs.length + 1}`, status: 'running', metadata: params.metadata as Record<string, unknown> }
        runs.push(run)
        return run
      },
      get: async (id: string) => {
        const run = runs.find((r) => r.run_id === id)
        if (!run) throw new NotFoundError('no run')
        return run
      },
      wait: async (id: string) => runtime.runs.get(id),
      cancel: async (id: string) => {
        calls.cancel.push(id)
        const run = runs.find((r) => r.run_id === id)
        if (!run) throw new NotFoundError('no run')
        if (run.status !== 'settled') Object.assign(run, { status: 'settled', outcome: { kind: 'failure', reason: 'canceled' } })
        return run
      },
      async *listAll() { yield* [...runs].reverse() },
    },
  }
  const deps: AssistantDeps = { db, runtimeFor: async (userId) => (calls.runtimeFor.push(userId), runtime as never) }
  const settle = (i: number, turn: unknown) => Object.assign(runs[i]!, { status: 'settled', outcome: { kind: 'result' }, result: turn })
  return { runs, calls, deps, settle }
}
const turn = (over: Partial<Turn> = {}): Turn => ({ message: 'Hello.', decision: null, card: null, ...over })
const send = (deps: AssistantDeps, id: string, text = 'Centaur lancer', msgId = ulid(), userId = 'owner') =>
  sendChat(deps, userId, { characterId: id, message: { id: msgId, text } })
function state(r: unknown): ChatState {
  assert.ok((r as ChatState).ok, JSON.stringify(r))
  return r as ChatState
}
const stateRow = async (id: string) => (await db.prepare('SELECT state, revision FROM character WHERE id = ?').bind(id).first<{ state: string; revision: number }>())!
const chatRow = (id: string) => db.prepare('SELECT * FROM builder_chat WHERE character_id = ?').bind(id).first<Record<string, unknown>>()

// ---- Acceptance 3 and 9: send, running, settle, stop ------------------------------------------------

test('sendChat starts one run and leaves character.state and revision untouched; settle stores the turn', async () => {
  const doc = await draftOf()
  const before = await stateRow(doc.id)
  const f = fake()
  const sent = state(await send(f.deps, doc.id, 'Centaur lancer, d6 Might and Agility'))
  assert.ok(sent.running)
  assert.equal(sent.messages.length, 1)
  assert.equal(f.runs.length, 1)
  const start = f.calls.start[0] as { params: Record<string, unknown>; options: Record<string, unknown> }
  assert.equal(start.params.deadline, '15m')
  assert.deepEqual(start.params.scopes, ['crtr:llm', 'crtr:act'])
  const row = (await chatRow(doc.id))!
  assert.equal(start.options.idempotencyKey, row.claim)
  assert.deepEqual(start.params.metadata, { feature: 'builder-assistant', characterId: doc.id, claim: row.claim })
  assert.equal(row.active_run_id, 'run-1')

  f.settle(0, turn({ message: 'A centaur it is.', card: { lines: [{ kind: 'kin', raceId: CENTAUR.id, subraceId: null, reason: 'You said centaur.' }] } }))
  const done = state(await getChat(f.deps, 'owner', { characterId: doc.id, wait: true }))
  assert.equal(done.running, null)
  assert.equal(done.error, null)
  const reply = done.messages[1]!
  assert.equal(reply.role, 'assistant')
  if (reply.role === 'assistant') {
    assert.equal(reply.runId, 'run-1')
    assert.equal(reply.card!.lines.length, 1)
    assert.ok(reply.card!.lines[0]!.id)
  }
  assert.deepEqual(await stateRow(doc.id), before, 'the character is byte-identical after send and settle')
  const claimAfter = (await chatRow(doc.id))!
  assert.equal(claimAfter.claim, null)
  assert.equal(claimAfter.active_run_id, null)
})

test('a resent message id is stored once, and a second send while a run holds the chat is busy', async () => {
  const doc = await draftOf()
  const f = fake()
  const id = ulid()
  state(await send(f.deps, doc.id, 'hello', id))
  assert.deepEqual(await send(f.deps, doc.id, 'hello', id), { ok: false, code: 'busy', message: 'The assistant is already answering' })
  assert.equal(f.runs.length, 1)
  f.settle(0, turn())
  state(await getChat(f.deps, 'owner', { characterId: doc.id, wait: false }))
  const again = state(await send(f.deps, doc.id, 'hello', id)) // a resent request after the reply: not appended twice
  assert.equal(again.messages.filter((m) => m.role === 'player').length, 1)
})

test('empty and over-long messages are bad_input and start no run', async () => {
  const doc = await draftOf()
  const f = fake()
  for (const text of ['  ', 'x'.repeat(2001)]) assert.deepEqual((await send(f.deps, doc.id, text) as { code: string }).code, 'bad_input')
  assert.equal(f.runs.length, 0)
  assert.equal(await chatRow(doc.id), null)
})

test('getChat after sendChat reports running with the same run; a reload sees it too (acceptance 9)', async () => {
  const doc = await draftOf()
  const f = fake()
  state(await send(f.deps, doc.id))
  const a = state(await getChat(f.deps, 'owner', { characterId: doc.id, wait: false }))
  const b = state(await getChat(f.deps, 'owner', { characterId: doc.id, wait: false }))
  assert.ok(a.running && b.running)
  assert.equal((await chatRow(doc.id))!.active_run_id, 'run-1')
  assert.equal(f.runs.length, 1)
})

test('stopChat cancels the run, stores stopped, keeps the message and leaves the draft unchanged', async () => {
  const doc = await draftOf()
  const before = await stateRow(doc.id)
  const f = fake()
  state(await send(f.deps, doc.id))
  assert.deepEqual(await stopChat(f.deps, 'owner', { characterId: doc.id }), { ok: true, stopped: true })
  assert.deepEqual(f.calls.cancel, ['run-1'])
  const s = state(await getChat(f.deps, 'owner', { characterId: doc.id, wait: false }))
  assert.equal(s.running, null)
  assert.deepEqual(s.error, { reason: 'stopped' })
  assert.equal(s.messages.length, 1)
  assert.deepEqual(await stateRow(doc.id), before)
  assert.deepEqual(await stopChat(f.deps, 'owner', { characterId: doc.id }), { ok: true, stopped: false }, 'nothing running now')
  const retried = state(await sendChat(f.deps, 'owner', { characterId: doc.id, retry: true }))
  assert.ok(retried.running)
  assert.equal(retried.error, null)
  assert.equal(retried.messages.length, 1, 'retry appends nothing')
})

test('a Stop that cannot be confirmed leaves the chat running and says retryable', async () => {
  const doc = await draftOf()
  const f = fake()
  state(await send(f.deps, doc.id))
  const real = f.deps.runtimeFor
  const broken: AssistantDeps = { db, runtimeFor: async (u) => { const rt = (await real(u)) as unknown as { runs: { cancel: () => Promise<never> } }; return { runs: { ...rt.runs, cancel: async () => { throw new Error('boom') } } } as never } }
  assert.deepEqual(await stopChat(broken, 'owner', { characterId: doc.id }), { ok: true, stopped: false, retryable: true })
  assert.ok(state(await getChat(f.deps, 'owner', { characterId: doc.id, wait: false })).running)
})

test('a run that settled without a result releases the chat with its reason', async () => {
  for (const [outcome, reason] of [[{ kind: 'failure', reason: 'declined' }, 'declined'], [{ kind: 'failure', reason: 'deadline_exceeded' }, 'deadline_exceeded'], [{ kind: 'failure', reason: 'boom' }, 'runtime_error']] as const) {
    const doc = await draftOf()
    const f = fake()
    state(await send(f.deps, doc.id))
    Object.assign(f.runs[0]!, { status: 'settled', outcome })
    const s = state(await getChat(f.deps, 'owner', { characterId: doc.id, wait: false }))
    assert.deepEqual([s.running, s.error], [null, { reason }])
    assert.equal(s.messages.length, 1)
  }
})

test('a result that fails the turn schema is runtime_error; a deleted run too', async () => {
  const a = await draftOf()
  const f = fake()
  state(await send(f.deps, a.id))
  f.settle(0, { message: 3 })
  assert.deepEqual(state(await getChat(f.deps, 'owner', { characterId: a.id, wait: false })).error, { reason: 'runtime_error' })
  const b = await draftOf()
  state(await send(f.deps, b.id))
  f.runs.pop()
  assert.deepEqual(state(await getChat(f.deps, 'owner', { characterId: b.id, wait: false })).error, { reason: 'runtime_error' })
})

test('a claim whose request died before recording a run: found by claim after 60 s, else released', async () => {
  const doc = await draftOf()
  const f = fake()
  await db.prepare("INSERT INTO builder_chat (character_id, messages, claim, claimed_at) VALUES (?, '[]', 'orphan', ?)").bind(doc.id, new Date(Date.now() - 120_000).toISOString()).run()
  f.runs.push({ run_id: 'found', status: 'running', metadata: { claim: 'orphan' } })
  assert.ok(state(await getChat(f.deps, 'owner', { characterId: doc.id, wait: false })).running)
  assert.equal((await chatRow(doc.id))!.active_run_id, 'found')
  f.runs.length = 0 // the run is gone
  await db.prepare("UPDATE builder_chat SET claim = 'orphan2', active_run_id = NULL, claimed_at = ? WHERE character_id = ?").bind(new Date(Date.now() - 120_000).toISOString(), doc.id).run()
  assert.deepEqual(state(await getChat(f.deps, 'owner', { characterId: doc.id, wait: false })).error, { reason: 'runtime_error' })
})

test('two readers settling one run store the reply once', async () => {
  const doc = await draftOf()
  const f = fake()
  state(await send(f.deps, doc.id))
  f.settle(0, turn({ message: 'Once.' }))
  const [a, b] = await Promise.all([getChat(f.deps, 'owner', { characterId: doc.id, wait: false }), getChat(f.deps, 'owner', { characterId: doc.id, wait: false })])
  for (const s of [a, b]) assert.equal(state(s).messages.length, 2)
  assert.equal(state(await getChat(f.deps, 'owner', { characterId: doc.id, wait: false })).messages.length, 2)
})

// ---- Acceptance 10: no connection ---------------------------------------------------------------------

test('a runtime that cannot be had keeps the player message and stores not_connected; the draft is unchanged', async () => {
  const doc = await draftOf()
  const before = await stateRow(doc.id)
  const deps: AssistantDeps = { db, runtimeFor: async () => { throw new CrouterError('no connection', 'not_connected') } }
  const s = state(await send(deps, doc.id, 'hello there'))
  assert.equal(s.running, null)
  assert.deepEqual(s.error, { reason: 'not_connected' })
  assert.deepEqual(s.messages.map((m) => m.role === 'player' && m.text), ['hello there'])
  assert.deepEqual(await stateRow(doc.id), before)
  const claimless = (await chatRow(doc.id))!
  assert.equal(claimless.claim, null)
})

test('a run that throws something else at start is runtime_error and still keeps the message', async () => {
  const doc = await draftOf()
  const deps: AssistantDeps = { db, runtimeFor: async () => ({ runs: { start: async () => { throw new Error('daemon down') } } }) as never }
  const quiet = console.error
  console.error = () => {}
  try {
    assert.deepEqual(state(await send(deps, doc.id)).error, { reason: 'runtime_error' })
  } finally {
    console.error = quiet
  }
})

// ---- Acceptance 11: authorization ----------------------------------------------------------------------

test('a stranger, the campaign GM, a bad id and a finished character get not_found from all three functions', async () => {
  const doc = await draftOf()
  const f = fake()
  state(await send(f.deps, doc.id))
  const runs = f.runs.length
  const done = ok(await finishDraft(db, 'owner', { characterId: (await draftOf('owner', complete())).id, revision: 1 }))
  await db.prepare('UPDATE character SET campaign_id = ? WHERE id = ?').bind('camp', doc.id).run() // the draft sits in the GM's campaign: still not theirs
  const notFound = { ok: false, code: 'not_found', message: 'No such draft' }
  for (const [who, id] of [['stranger', doc.id], ['gm', doc.id], ['owner', 'nope'], ['owner', done.id]] as const) {
    assert.deepEqual(await getChat(f.deps, who, { characterId: id, wait: false }), notFound, `${who} getChat`)
    assert.deepEqual(await sendChat(f.deps, who, { characterId: id, message: { id: ulid(), text: 'hi' } }), notFound, `${who} sendChat`)
    assert.deepEqual(await sendChat(f.deps, who, { characterId: id, retry: true }), notFound, `${who} retry`)
    assert.deepEqual(await stopChat(f.deps, who, { characterId: id }), notFound, `${who} stopChat`)
  }
  assert.equal(f.runs.length, runs, 'no run was started for them')
  assert.equal((await chatRow(doc.id))!.archived, 0)
})

// ---- Acceptance 12: Finish archives ----------------------------------------------------------------------

function complete(): Partial<BuilderInput> {
  return {
    raceId: CENTAUR.id, dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
    professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }],
  }
}

test('Finish archives the chat in the same batch, clears its claim, and every function then says not_found', async () => {
  const doc = await draftOf('owner', complete())
  const f = fake()
  state(await send(f.deps, doc.id))
  const saved = ok(await saveDraft(db, 'owner', { characterId: doc.id, revision: 1, builder: (doc.state as { builder: BuilderInput }).builder, pending: [] }))
  ok(await finishDraft(db, 'owner', { characterId: doc.id, revision: saved.revision }))
  const row = (await chatRow(doc.id))!
  assert.deepEqual([row.archived, row.claim, row.active_run_id, row.stop_requested], [1, null, null, 0])
  assert.ok(JSON.parse(row.messages as string).length === 1, 'the chat is kept')
  // A run that settles afterwards cannot write: its claim is gone.
  f.settle(0, turn())
  for (const out of [await getChat(f.deps, 'owner', { characterId: doc.id, wait: false }), await send(f.deps, doc.id), await stopChat(f.deps, 'owner', { characterId: doc.id })])
    assert.equal((out as { code: string }).code, 'not_found')
  assert.equal(JSON.parse((await chatRow(doc.id))!.messages as string).length, 1)
})

test('Finish of a draft that never had a chat still commits (no chat row to archive)', async () => {
  const doc = await draftOf('owner', complete())
  ok(await finishDraft(db, 'owner', { characterId: doc.id, revision: 1 }))
  assert.equal(await chatRow(doc.id), null)
})

test('the authorization query requires archived = 0 and a draft owned by the caller (code check)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/server/assistant.ts', import.meta.url), 'utf8')
  assert.match(src, /ch\.owner_user_id = \?/)
  assert.match(src, /json_extract\(ch\.state, '\$\.draft'\) = 1/)
  assert.match(src, /COALESCE\(bc\.archived, 0\) = 0/)
})

// ---- Acceptance 6: the prompt -------------------------------------------------------------------------------

test('the prompt marks the dream and aspects "written by the player: do not change" and is built from the stored draft only', async () => {
  const doc = await draftOf('owner', { raceId: CENTAUR.id, dream: 'To see the sea', deepKnowledgeAspect: 'Knows every herb' })
  const f = fake()
  state(await send(f.deps, doc.id, 'handle the rules for me'))
  const prompt = (f.calls.start[0] as { params: { prompt: string } }).params.prompt
  for (const text of ['To see the sea', 'Loyal to a fault', 'Stubborn as a mule', 'Knows every herb', 'Ysolde'])
    assert.match(prompt, new RegExp(`written by the player: do not change: "${text}"`))
  for (let n = 1; n <= 10; n++) assert.ok(prompt.includes(`\n\n${n}. `) || prompt.startsWith(`${n}. `), `rule ${n}`)
  assert.match(prompt, /Player: handle the rules for me/)
  assert.match(prompt, /https:\/\/rules\.heartrush\.party\/md\/search/)
  assert.ok(prompt.includes(`${CENTAUR.id} | Centaur |`))
  assert.match(prompt, /player\.talents\.elemental-affinity \| .* \| \d+ XP/)
  assert.match(prompt, /With this kin: HP \d+/)
})

test('the prompt before a kin is chosen says prices come after, and drops the oldest messages past 30 000 characters', () => {
  const draft = { builder: builder(), pending: [] }
  const messages = Array.from({ length: 60 }, (_, i) => ({ id: `m${i}`, role: 'player' as const, text: `message ${i} ${'x'.repeat(800)}`, at: at() }))
  const prompt = assistantPrompt(draft, messages, cat)
  assert.match(prompt, /price after kin is chosen/)
  assert.match(prompt, /\(earlier messages were omitted\)/)
  assert.ok(!prompt.includes('message 0 x'))
  assert.ok(prompt.includes('message 59 x'))
})

test('turnSchema still parses what the fake runs return', () => {
  assert.ok(turnSchema.safeParse(turn()).success)
})
