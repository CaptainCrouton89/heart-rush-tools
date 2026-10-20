import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  createJournalEntry, deleteJournalEntry, editJournalEntry, listJournal, listSharedJournal, publishJournalWrite, setJournalShared,
  type JournalEntry, type JournalRefusal,
} from '../src/server/journal'
import { assignCharacterToCampaign, removeCharacterFromCampaign } from '../src/server/campaigns'
import type { LiveEvent } from '../src/server/live'
import { openPlayDbs, type D1 } from './db'

let t: Awaited<ReturnType<typeof openPlayDbs>>
let db: D1
before(async () => {
  t = await openPlayDbs()
  db = t.DB
})
after(() => t.dispose())

// Users: owner (player, owns Ysolde), gm (the campaign's GM), member (another player), stranger (in no campaign).
// Ysolde is in campaign `camp` at day 5 with open session `s1`; Wanderer belongs to `owner` and is in no campaign.
beforeEach(async () => {
  await db.prepare('DELETE FROM campaign').run()
  await db.prepare('DELETE FROM character').run()
  await db.prepare('DELETE FROM user').run()
  for (const id of ['owner', 'gm', 'member', 'stranger']) await db.prepare('INSERT INTO user (id, display_name) VALUES (?, ?)').bind(id, id).run()
  await db.prepare('INSERT INTO campaign (id, name, gm_user_id, current_day) VALUES (?, ?, ?, ?)').bind('camp', 'The Table', 'gm', 5).run()
  for (const [user, role] of [['gm', 'gm'], ['owner', 'player'], ['member', 'player']]) {
    await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('camp', user, role).run()
  }
  await db.prepare('INSERT INTO campaign_session (id, campaign_id, number, real_date, start_day) VALUES (?, ?, ?, ?, ?)').bind('s1', 'camp', 1, '2026-10-20', 4).run()
  const state = JSON.stringify({ schemaVersion: 1, draft: false })
  await db.prepare('INSERT INTO character (id, owner_user_id, campaign_id, name, state) VALUES (?, ?, ?, ?, ?)').bind('ysolde', 'owner', 'camp', 'Ysolde', state).run()
  await db.prepare('INSERT INTO character (id, owner_user_id, campaign_id, name, state) VALUES (?, ?, ?, ?, ?)').bind('wanderer', 'owner', null, 'Wanderer', state).run()
})

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  assert.equal(r.ok, true, JSON.stringify(r))
  return r as Extract<T, { ok: true }>
}
function refused(r: { ok: boolean }, status: number, code: string) {
  assert.equal(r.ok, false)
  assert.equal((r as JournalRefusal).status, status)
  assert.equal((r as JournalRefusal).code, code)
}
const write = async (characterId = 'ysolde', body = 'We reached the ford.') =>
  ok(await createJournalEntry(db, 'owner', { characterId, body })).entry
const sharedIds = async (user: string) => ok(await listSharedJournal(db, user, { campaignId: 'camp' })).entries.map((e) => e.id)

/** A stand-in for the CAMPAIGN_CHANNEL binding that records every published event. */
function fakeChannel() {
  const events: { campaign: string; event: LiveEvent }[] = []
  const env = {
    CAMPAIGN_CHANNEL: {
      idFromName: (name: string) => name,
      get: (name: string) => ({
        fetch: async (_: unknown, init: RequestInit) => {
          events.push({ campaign: name, event: JSON.parse(String(init.body)) })
          return new Response(null, { status: 204 })
        },
      }),
    },
  } as unknown as Parameters<typeof publishJournalWrite>[0]
  return { env, events }
}

test('criterion 22: the GM and another member are refused a private entry and the shared list omits it', async () => {
  const entry = await write()
  assert.deepEqual(ok(await listJournal(db, 'owner', { characterId: 'ysolde' })).entries.map((e) => e.id), [entry.id])
  for (const user of ['gm', 'member', 'stranger']) {
    refused(await listJournal(db, user, { characterId: 'ysolde' }), 403, 'forbidden')
    refused(await editJournalEntry(db, user, { entryId: entry.id, body: 'x' }), 403, 'forbidden')
    refused(await setJournalShared(db, user, { entryId: entry.id, shared: true }), 403, 'forbidden')
    refused(await deleteJournalEntry(db, user, { entryId: entry.id }), 403, 'forbidden')
    refused(await createJournalEntry(db, user, { characterId: 'ysolde', body: 'x' }), 403, 'forbidden')
  }
  for (const user of ['owner', 'gm', 'member']) assert.deepEqual(await sharedIds(user), [])
  const row = await db.prepare('SELECT body, shared FROM journal_entry WHERE id = ?').bind(entry.id).first<{ body: string; shared: number }>()
  assert.deepEqual(row, { body: 'We reached the ford.', shared: 0 })
})

test('criterion 22: share → listed under its session with the character name; unshare → gone', async () => {
  const entry = await write()
  const shared = ok(await setJournalShared(db, 'owner', { entryId: entry.id, shared: true }))
  assert.equal(shared.entry.shared, true)
  for (const user of ['owner', 'gm', 'member']) {
    const [listed, ...rest] = ok(await listSharedJournal(db, user, { campaignId: 'camp' })).entries
    assert.equal(rest.length, 0)
    assert.equal(listed.id, entry.id)
    assert.equal(listed.characterName, 'Ysolde')
    assert.equal(listed.sessionId, 's1')
    assert.equal(listed.inGameDay, 5)
    assert.equal(listed.body, 'We reached the ford.')
    assert.equal('shared' in listed, false)
  }
  // The author's own list still shows it, now shared.
  assert.equal(ok(await listJournal(db, 'owner', { characterId: 'ysolde' })).entries[0].shared, true)
  ok(await setJournalShared(db, 'owner', { entryId: entry.id, shared: false }))
  for (const user of ['owner', 'gm', 'member']) assert.deepEqual(await sharedIds(user), [])
})

test('listSharedJournal is for members only, and lists a shared entry made between sessions with a null session', async () => {
  refused(await listSharedJournal(db, 'stranger', { campaignId: 'camp' }), 403, 'forbidden')
  refused(await listSharedJournal(db, 'stranger', { campaignId: 'no-such' }), 403, 'forbidden')
  await db.prepare('UPDATE campaign_session SET end_day = 6 WHERE id = ?').bind('s1').run()
  const between = await write('ysolde', 'Between sessions.')
  assert.equal(between.sessionId, null)
  ok(await setJournalShared(db, 'owner', { entryId: between.id, shared: true }))
  const [listed] = ok(await listSharedJournal(db, 'member', { campaignId: 'camp' })).entries
  assert.equal(listed.id, between.id)
  assert.equal(listed.sessionId, null)
})

test('a campaign never sees another campaign\'s shared entries', async () => {
  await db.prepare('INSERT INTO campaign (id, name, gm_user_id) VALUES (?, ?, ?)').bind('other', 'Other', 'stranger').run()
  await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('other', 'stranger', 'gm').run()
  const entry = await write()
  ok(await setJournalShared(db, 'owner', { entryId: entry.id, shared: true }))
  assert.deepEqual(ok(await listSharedJournal(db, 'stranger', { campaignId: 'other' })).entries, [])
})

test('a share keeps the campaign it was made in: share in A, leave, join B → B\'s members cannot read it, and it is private again', async () => {
  await db.prepare('INSERT INTO campaign (id, name, gm_user_id) VALUES (?, ?, ?)').bind('b', 'Other Table', 'stranger').run()
  for (const [user, role] of [['stranger', 'gm'], ['owner', 'player']]) await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('b', user, role).run()
  const entry = await write()
  ok(await setJournalShared(db, 'owner', { entryId: entry.id, shared: true }))
  assert.deepEqual(await sharedIds('member'), [entry.id])

  ok(await removeCharacterFromCampaign(db, 'owner', { characterId: 'ysolde' }))
  assert.deepEqual(await sharedIds('member'), [])
  assert.equal(ok(await listJournal(db, 'owner', { characterId: 'ysolde' })).entries[0].shared, false)

  ok(await assignCharacterToCampaign(db, 'owner', { characterId: 'ysolde', campaignId: 'b' }))
  assert.deepEqual(ok(await listSharedJournal(db, 'stranger', { campaignId: 'b' })).entries, [])
  assert.deepEqual(await sharedIds('member'), [])
  // Only the owner's new choice shares it, with the campaign it is in now.
  ok(await setJournalShared(db, 'owner', { entryId: entry.id, shared: true }))
  assert.deepEqual(ok(await listSharedJournal(db, 'stranger', { campaignId: 'b' })).entries.map((e) => e.id), [entry.id])
  assert.deepEqual(await sharedIds('member'), [])
})

test('a share left over from a deleted campaign is cleared when the character joins another', async () => {
  await db.prepare('INSERT INTO campaign (id, name, gm_user_id) VALUES (?, ?, ?)').bind('b', 'Other Table', 'stranger').run()
  await db.prepare('INSERT INTO campaign_member (campaign_id, user_id, role) VALUES (?, ?, ?)').bind('b', 'owner', 'player').run()
  const entry = await write()
  ok(await setJournalShared(db, 'owner', { entryId: entry.id, shared: true }))
  await db.prepare("DELETE FROM campaign WHERE id = 'camp'").run() // character.campaign_id becomes NULL without removeCharacterFromCampaign
  ok(await assignCharacterToCampaign(db, 'owner', { characterId: 'ysolde', campaignId: 'b' }))
  assert.deepEqual(ok(await listSharedJournal(db, 'owner', { campaignId: 'b' })).entries, [])
})

test('criterion 23: writing, editing, sharing and deleting leave character.revision and state unchanged', async () => {
  const before = await db.prepare('SELECT revision, state, updated_at FROM character WHERE id = ?').bind('ysolde').first()
  const eventsBefore = await db.prepare('SELECT COUNT(*) AS n FROM character_event').first<{ n: number }>()
  const entry = await write()
  ok(await editJournalEntry(db, 'owner', { entryId: entry.id, body: 'Edited.' }))
  ok(await setJournalShared(db, 'owner', { entryId: entry.id, shared: true }))
  ok(await setJournalShared(db, 'owner', { entryId: entry.id, shared: false }))
  ok(await deleteJournalEntry(db, 'owner', { entryId: entry.id }))
  assert.deepEqual(await db.prepare('SELECT revision, state, updated_at FROM character WHERE id = ?').bind('ysolde').first(), before)
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM character_event').first<{ n: number }>())!.n, eventsBefore!.n)
})

test('criterion 23: the day and open session are stamped in a campaign and both null outside one', async () => {
  const inCampaign = await write('ysolde')
  assert.equal(inCampaign.inGameDay, 5)
  assert.equal(inCampaign.sessionId, 's1')
  assert.equal(inCampaign.sessionNumber, 1)
  const alone = await write('wanderer')
  assert.equal(alone.inGameDay, null)
  assert.equal(alone.sessionId, null)
  assert.equal(alone.shared, false)
  // A campaign with no open session stamps the day only.
  await db.prepare('UPDATE campaign_session SET end_day = 5 WHERE id = ?').bind('s1').run()
  await db.prepare('UPDATE campaign SET current_day = 9 WHERE id = ?').bind('camp').run()
  const later = await write('ysolde')
  assert.equal(later.inGameDay, 9)
  assert.equal(later.sessionId, null)
})

test('outside a campaign an entry cannot be shared, and can still be edited and deleted', async () => {
  const entry = await write('wanderer')
  refused(await setJournalShared(db, 'owner', { entryId: entry.id, shared: true }), 409, 'not_in_campaign')
  assert.equal(ok(await editJournalEntry(db, 'owner', { entryId: entry.id, body: 'Edited.' })).entry.body, 'Edited.')
  ok(await deleteJournalEntry(db, 'owner', { entryId: entry.id }))
  assert.deepEqual(ok(await listJournal(db, 'owner', { characterId: 'wanderer' })).entries, [])
})

test('entries list newest first; edit changes only the body; delete removes the row', async () => {
  const first = await write('ysolde', 'one')
  await new Promise((r) => setTimeout(r, 5))
  const second = await write('ysolde', 'two')
  const listed = ok(await listJournal(db, 'owner', { characterId: 'ysolde' })).entries
  assert.deepEqual(listed.map((e) => e.id), [second.id, first.id])
  const edited = ok(await editJournalEntry(db, 'owner', { entryId: first.id, body: 'one, revised' })).entry
  const { body: _b, updatedAt: _u, ...kept } = edited
  const { body: _b2, updatedAt: _u2, ...original } = first
  assert.deepEqual(kept, original)
  assert.equal(edited.body, 'one, revised')
  ok(await deleteJournalEntry(db, 'owner', { entryId: first.id }))
  assert.deepEqual(ok(await listJournal(db, 'owner', { characterId: 'ysolde' })).entries.map((e: JournalEntry) => e.id), [second.id])
  refused(await deleteJournalEntry(db, 'owner', { entryId: first.id }), 404, 'not_found')
})

test('bad input and unknown ids are refused', async () => {
  refused(await createJournalEntry(db, 'owner', { characterId: 'ysolde', body: '   ' }), 400, 'bad_input')
  refused(await createJournalEntry(db, 'owner', { characterId: 'ysolde', body: 'x'.repeat(20001) }), 400, 'bad_input')
  refused(await createJournalEntry(db, 'owner', { characterId: 'no-such', body: 'x' }), 404, 'not_found')
  refused(await listJournal(db, 'owner', { characterId: 'no-such' }), 404, 'not_found')
  refused(await editJournalEntry(db, 'owner', { entryId: 'no-such', body: 'x' }), 404, 'not_found')
  refused(await setJournalShared(db, 'owner', { entryId: 'no-such', shared: true }), 404, 'not_found')
  const entry = await write()
  refused(await setJournalShared(db, 'owner', { entryId: entry.id, shared: 'yes' as unknown as boolean }), 400, 'bad_input')
  refused(await editJournalEntry(db, 'owner', { entryId: entry.id, body: 5 as unknown as string }), 400, 'bad_input')
})

test('criterion 23: a share publishes one campaign event; a private write publishes nothing', async () => {
  const { env, events } = fakeChannel()
  const publishAfter = async (result: { ok: boolean; campaignId?: string | null }) => publishJournalWrite(env, result)

  const entry = await write()
  await publishAfter(await createJournalEntry(db, 'owner', { characterId: 'ysolde', body: 'private' }))
  await publishAfter(await editJournalEntry(db, 'owner', { entryId: entry.id, body: 'still private' }))
  await publishAfter(await setJournalShared(db, 'owner', { entryId: entry.id, shared: false })) // no change
  await publishAfter(await deleteJournalEntry(db, 'owner', { entryId: (await write()).id }))
  assert.deepEqual(events, [])

  await publishAfter(await setJournalShared(db, 'owner', { entryId: entry.id, shared: true }))
  assert.deepEqual(events, [{ campaign: 'camp', event: { type: 'campaign' } }])

  await publishAfter(await editJournalEntry(db, 'owner', { entryId: entry.id, body: 'now public' }))
  assert.equal(events.length, 2)
  await publishAfter(await setJournalShared(db, 'owner', { entryId: entry.id, shared: false }))
  assert.equal(events.length, 3)

  const again = await write()
  ok(await setJournalShared(db, 'owner', { entryId: again.id, shared: true }))
  await publishAfter(await deleteJournalEntry(db, 'owner', { entryId: again.id }))
  assert.equal(events.length, 4)
  assert.ok(events.every((e) => e.campaign === 'camp' && e.event.type === 'campaign'))

  const before = events.length
  await publishAfter(await editJournalEntry(db, 'gm', { entryId: entry.id, body: 'x' })) // refused
  assert.equal(events.length, before)
})
