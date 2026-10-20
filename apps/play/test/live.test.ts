import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ulid } from 'ulid'
import type { BuilderInput, ClientAction } from '@heartrush/rules-engine/types'
import { getCatalogue } from '../src/catalogue'
import { applyCharacterAction, createDraft, finishDraft } from '../src/server/characters'
import { connectLive, publish, publishCharacterWrite, type LiveEvent } from '../src/server/live'
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
  for (const id of ['owner', 'member', 'stranger']) await db.prepare('INSERT INTO user (id, display_name) VALUES (?, ?)').bind(id, id).run()
  await db.prepare('INSERT INTO campaign (id, name, gm_user_id) VALUES (?, ?, ?)').bind('camp', 'The Table', 'owner').run()
  await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('camp', 'owner', 'gm').run()
  await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('camp', 'member', 'player').run()
})

/** A stand-in for the CAMPAIGN_CHANNEL binding that records which object each call reached. */
function fakeChannel(answer: (request: Request) => Response | Promise<Response> = () => new Response(null, { status: 204 })) {
  const calls: { name: string; url: string; method: string; upgrade: string | null; body: string | null }[] = []
  const env = {
    DB: db,
    CAMPAIGN_CHANNEL: {
      idFromName: (name: string) => name,
      get: (name: string) => ({
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(input, init)
          calls.push({ name, url: request.url, method: request.method, upgrade: request.headers.get('upgrade'), body: init?.body ? String(init.body) : null })
          return answer(request)
        },
      }),
    },
  } as unknown as Parameters<typeof connectLive>[0]
  return { env, calls }
}

const upgrade = () => new Request('https://play.test/campaigns/camp/live', { headers: { upgrade: 'websocket' } })

test('a non-member upgrade is refused with 403 and never reaches the object', async () => {
  const { env, calls } = fakeChannel()
  const response = await connectLive(env, 'stranger', 'camp', upgrade())
  assert.equal(response.status, 403)
  assert.equal(calls.length, 0)
})

test('a user who is in no campaign at all is refused for an unknown campaign id too', async () => {
  const { env, calls } = fakeChannel()
  assert.equal((await connectLive(env, 'owner', 'no-such-campaign', upgrade())).status, 403)
  assert.equal(calls.length, 0)
})

test('a member (player or GM) upgrade is forwarded to that campaign\'s object', async () => {
  for (const userId of ['member', 'owner']) {
    const { env, calls } = fakeChannel(() => new Response('upgraded', { status: 200 }))
    const response = await connectLive(env, userId, 'camp', upgrade())
    assert.equal(await response.text(), 'upgraded')
    assert.deepEqual(calls.map((c) => [c.name, c.upgrade]), [['camp', 'websocket']])
  }
})

test('a request that is not a WebSocket upgrade is refused before any lookup', async () => {
  const { env, calls } = fakeChannel()
  assert.equal((await connectLive(env, 'member', 'camp', new Request('https://play.test/campaigns/camp/live'))).status, 426)
  assert.equal(calls.length, 0)
})

// ---- publishing ----------------------------------------------------------------------------------

const cat = getCatalogue()
const CENTAUR = [...cat.races.values()].find((r) => r.title === 'Centaur')!
const at = () => new Date().toISOString()
function builder(): BuilderInput {
  return {
    id: ulid(), at: at(), name: 'Ysolde', pronouns: 'she/her', dream: '', description: '', motivation: '', portrait: null,
    raceId: CENTAUR.id, subraceId: null, kinChoices: {},
    dice: { might: 6, agility: 6, cunning: 4, presence: 4 },
    ageCategory: 'adult', ageBenefits: [], createdAspects: ['Loyal', 'Stubborn'],
    professions: [{ name: 'Smith', rank: 2 }, { name: 'Cook', rank: 2 }], bloodmarkLevel: 1,
  }
}
const addItem = (): ClientAction => ({ kind: 'gear:item:add', item: { name: 'Rope', slots: 1, quantity: 1, notes: '' }, id: ulid(), at: at() })

/** A finished character owned by `owner`, in `campaignId` (or none). */
async function finishedIn(campaignId: string | null) {
  const created = await createDraft(db, 'owner', { builder: builder() })
  assert.ok(created.ok)
  const finished = await finishDraft(db, 'owner', { characterId: created.character.id, revision: created.character.revision })
  assert.ok(finished.ok)
  if (campaignId) await db.prepare('UPDATE character SET campaign_id = ? WHERE id = ?').bind(campaignId, finished.character.id).run()
  return finished.character
}

test('an apply on a campaign character publishes exactly one character event with the new revision', async () => {
  const doc = await finishedIn('camp')
  const { env, calls } = fakeChannel()
  const result = await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: doc.revision, action: addItem() })
  await publishCharacterWrite(env, result)
  assert.ok(result.ok)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'camp')
  assert.deepEqual(JSON.parse(calls[0].body!), { type: 'character', characterId: doc.id, revision: doc.revision + 1 } satisfies LiveEvent)
})

test('nothing is published for a character in no campaign, or for a refused write', async () => {
  const solo = await finishedIn(null)
  const { env, calls } = fakeChannel()
  await publishCharacterWrite(env, await applyCharacterAction(db, 'owner', { characterId: solo.id, revision: solo.revision, action: addItem() }))
  const inCamp = await finishedIn('camp')
  await publishCharacterWrite(env, await applyCharacterAction(db, 'owner', { characterId: inCamp.id, revision: inCamp.revision + 5, action: addItem() })) // stale: conflict
  assert.equal(calls.length, 0)
})

test('a publish that throws or is refused leaves the write committed and does not throw', async () => {
  const doc = await finishedIn('camp')
  for (const answer of [() => { throw new Error('object unreachable') }, () => new Response('nope', { status: 500 })]) {
    const { env } = fakeChannel(answer)
    const before = (await db.prepare('SELECT revision FROM character WHERE id = ?').bind(doc.id).first<{ revision: number }>())!.revision
    const result = await applyCharacterAction(db, 'owner', { characterId: doc.id, revision: before, action: addItem() })
    await publishCharacterWrite(env, result) // must resolve
    assert.ok(result.ok)
    const after = (await db.prepare('SELECT revision FROM character WHERE id = ?').bind(doc.id).first<{ revision: number }>())!.revision
    assert.equal(after, before + 1)
  }
  await publish(fakeChannel(() => { throw new Error('boom') }).env, 'camp', { type: 'campaign' }) // resolves
})
