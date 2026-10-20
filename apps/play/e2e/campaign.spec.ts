import { test, expect, PLAY, CAMPAIGN, HERO, heroInCampaign, gotoLive, historyRows, historySection, shot } from './fixtures'
import type { Page } from '@playwright/test'

// The three Phase 2 campaign tabs as the GM uses them (spec criteria 1–4, 6–7): rename, day counter, sessions with an
// XP award, and stratagems with an objective roll that lands in the roll feed. Silas is the GM of V1 Campaign and owns
// V1 Hero in it, so he is also the objective's leader's player.

const campaignTab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Campaign' }).getByRole('tab', { name })
const dayLabel = (page: Page) => page.getByRole('main').getByText(/^Day \d+$/)
async function currentDay(page: Page): Promise<number> {
  return Number((await dayLabel(page).innerText()).replace('Day ', ''))
}

test('spec 1: /parties is 404 and /campaigns lists the campaign', async ({ page }) => {
  const parties = await page.request.get(`${PLAY}/parties`, { maxRedirects: 0 })
  expect(parties.status()).toBe(404)
  await page.goto(`${PLAY}/campaigns`)
  await expect(page.getByRole('heading', { name: 'Campaigns', level: 1 })).toBeVisible()
  await campaignUrlExists(page)
  await expect(page.getByText(/part(y|ies)/i)).toHaveCount(0)
})

async function campaignUrlExists(page: Page) {
  await heroInCampaign(page)
  await page.goto(`${PLAY}/campaigns`)
  await expect(page.getByRole('link', { name: new RegExp(`^${CAMPAIGN} Day`) })).toHaveCount(1)
}

test('spec 2: GM +1 day / +7 days / Set day; a second open page of the campaign follows without reload', async ({ page, openTab }) => {
  const { campaign } = await heroInCampaign(page)
  await page.goto(campaign)
  const other = await openTab()
  await gotoLive(other, campaign)
  const start = await currentDay(page)

  await page.getByRole('button', { name: '+1 day' }).click()
  await expect(dayLabel(page)).toHaveText(`Day ${start + 1}`)
  await expect(dayLabel(other), 'the other open page shows the new day without reload').toHaveText(`Day ${start + 1}`, { timeout: 2_000 })

  await page.getByRole('button', { name: '+7 days' }).click()
  await expect(dayLabel(page)).toHaveText(`Day ${start + 8}`)
  await expect(dayLabel(other)).toHaveText(`Day ${start + 8}`, { timeout: 2_000 })

  await page.getByRole('button', { name: 'Set day' }).click()
  await page.getByRole('textbox', { name: 'Day' }).fill('1')
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await expect(dayLabel(page)).toHaveText('Day 1')
  await expect(dayLabel(other)).toHaveText('Day 1', { timeout: 2_000 })
  await shot(page, 'campaign-spec2-day')
})

test('spec 3 + 4: Start session; a second start is refused; Award XP 3 is logged on the open session; End after +3 days', async ({ page }) => {
  const { hero, campaign } = await heroInCampaign(page)
  await page.goto(campaign)
  await campaignTab(page, 'Sessions').click()

  // An earlier run's session left open: end it so this run starts from a closed log.
  const endOld = page.getByRole('button', { name: /^End session \d+$/ })
  if (await endOld.isVisible()) {
    await endOld.click()
    await expect(endOld).toHaveCount(0)
  }
  const sessions = page.getByRole('list', { name: 'Sessions, newest first' })
  const before = (await sessions.count()) ? await sessions.getByRole('article').count() : 0
  const n = before + 1
  const day = await currentDay(page)

  await page.getByRole('button', { name: 'Start session' }).click()
  const session = page.getByRole('article', { name: new RegExp(`^Session ${n}(Open)?$`) })
  await expect(session).toBeVisible()
  await expect(session).toContainText('Open')
  await expect(session).toContainText(`From day ${day}`)

  await page.getByRole('button', { name: 'Start session' }).click()
  await expect(page.getByRole('alert')).toHaveText(`End session ${n} first`)

  // Award XP 3 from the Characters tab while the session is open.
  await campaignTab(page, 'Characters').click()
  await page.getByRole('button', { name: 'Award XP' }).click()
  await page.getByRole('textbox', { name: 'XP for every character' }).fill('3')
  await page.getByRole('button', { name: 'Award', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /^Awarded 3 XP to \d+ characters?\.$/ })).toBeVisible()
  await campaignTab(page, 'Sessions').click()
  await expect(session).toContainText('XP awarded: 3 (3 each)')

  // +3 days, then End: the session spans day → day + 3.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '+1 day' }).click()
    await expect(dayLabel(page)).toHaveText(`Day ${day + i + 1}`)
  }
  await page.getByRole('button', { name: `End session ${n}` }).click()
  await expect(session).not.toContainText('Open')
  await expect(session).toContainText(`Days ${day}–${day + 3}`)
  await shot(page, 'campaign-spec3-sessions')

  // The hero got exactly one xp:award event for it; undo it so the hero's XP is unchanged by this run.
  await page.goto(hero)
  await expect.poll(async () => (await historyRows(page))[0]).toMatch(/^Awarded 3 XP/)
  await historySection(page).getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await historyRows(page))[0]).toMatch(/^Undid: Awarded 3 XP/)

  // Back to day 1 for the next spec.
  await page.goto(campaign)
  await page.getByRole('button', { name: 'Set day' }).click()
  await page.getByRole('textbox', { name: 'Day' }).fill('1')
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await expect(dayLabel(page)).toHaveText('Day 1')
})

const GOAL = 'V1 Take Thornwall'
const OBJ1 = 'Cut the supply road'
const OBJ2 = 'Bribe the gate captain'

test('spec 6 + 7: stratagem CN from setup, hindrance and asset; own CN; the leader rolls and the feed shows the objective and CN', async ({ page }) => {
  const { campaign } = await heroInCampaign(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(campaign)
  await campaignTab(page, 'Stratagems').click()
  const card = page.getByRole('article', { name: GOAL })

  // Create it once (there is no delete); a later run edits it back to the starting shape.
  if ((await card.count()) === 0) {
    await page.getByRole('button', { name: 'New stratagem' }).click()
    await page.getByRole('textbox', { name: 'Goal' }).fill(GOAL)
    await page.getByRole('textbox', { name: 'Time per roll' }).fill('1 week')
    await page.getByRole('textbox', { name: 'Setup CN' }).fill('12')
    await page.getByRole('button', { name: 'Add objective' }).click()
    await page.getByRole('textbox', { name: 'Objective 1' }).fill(OBJ1)
    const leader = page.getByRole('combobox', { name: 'Leader' })
    const option = (await leader.getByRole('option').allInnerTexts()).find((t) => t.startsWith(`${HERO} (`))
    await leader.selectOption({ label: option! })
    await page.getByRole('button', { name: 'Add hindrance' }).click()
    await page.getByRole('textbox', { name: 'Name of hindrance 1' }).fill('Winter storms')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
  } else {
    await card.getByRole('button', { name: 'Edit', exact: true }).click()
    const form = page.locator('form', { has: page.getByRole('textbox', { name: 'Goal' }) })
    for (const name of ['Siege engines', 'Winter storms']) {
      const remove = form.getByRole('button', { name: `Remove ${name}` })
      if (await remove.count()) await remove.click()
    }
    const second = form.getByRole('button', { name: 'Remove objective 2' })
    if (await second.count()) await second.click()
    await form.getByRole('button', { name: 'Add hindrance' }).click()
    await form.getByRole('textbox', { name: 'Name of hindrance 1' }).fill('Winter storms')
    await form.getByRole('button', { name: 'Save', exact: true }).click()
  }
  const objective1 = card.getByRole('listitem').filter({ hasText: OBJ1 })
  await expect(objective1.getByLabel('Current CN 15'), 'setup 12 + one hindrance').toBeVisible()

  // Add an asset → 12; a second objective with its own CN 9 and the same asset and hindrance → 9.
  await card.getByRole('button', { name: 'Edit', exact: true }).click()
  const form = page.locator('form', { has: page.getByRole('textbox', { name: 'Goal' }) })
  await form.getByRole('button', { name: 'Add asset' }).click()
  await form.getByRole('textbox', { name: 'Name of asset 2' }).fill('Siege engines')
  await form.getByRole('button', { name: 'Add objective' }).click()
  await form.getByRole('textbox', { name: 'Objective 2' }).fill(OBJ2)
  await form.getByRole('textbox', { name: 'Own CN' }).nth(1).fill('9')
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(objective1.getByLabel('Current CN 12'), 'one asset cancels the hindrance').toBeVisible()
  await expect(card.getByRole('listitem').filter({ hasText: OBJ2 }).getByLabel('Current CN 9')).toBeVisible()

  // Spec 7: the leader's player (Silas owns V1 Hero) sees Roll on objective 1; the objective with no leader has none.
  await expect(card.getByRole('listitem').filter({ hasText: OBJ2 }).getByRole('button', { name: 'Roll', exact: true })).toHaveCount(0)
  const feed = page.getByRole('complementary').getByRole('list', { name: 'Rolls, newest first' })
  // Each feed entry is an article (its dice are list items too, so count articles).
  const rollsBefore = (await feed.count()) ? await feed.getByRole('article').count() : 0
  await objective1.getByRole('button', { name: 'Roll', exact: true }).click()
  const panel = page.getByRole('dialog', { name: `Roll: ${GOAL} — ${OBJ1}` })
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: 'Roll Might check' }).click()
  await expect(panel.getByLabel(/^Total \d+$/)).toBeVisible()
  // A kept 1 asks Fail or Reroll; take Fail so the roll is final.
  const fail = panel.getByRole('button', { name: 'Fail', exact: true })
  if (await fail.isVisible()) await fail.click()
  await shot(page, 'campaign-spec7-objective-roll')
  await panel.getByRole('button', { name: 'Close' }).click()

  await expect(feed.getByRole('article')).toHaveCount(Math.min(rollsBefore + 1, 200))
  const newest = feed.getByRole('article').first()
  await expect(newest).toContainText(`${GOAL} — ${OBJ1} (CN 12)`)
  await expect(newest).toContainText(HERO)
  // The objective's state is unchanged by the roll.
  await expect(objective1).toContainText('Open')
  await expect(objective1.getByLabel('Current CN 12')).toBeVisible()
  await shot(page, 'campaign-spec7-feed')
})

test('roll feed on a phone: the Rolls tab shows the same feed', async ({ page }) => {
  const { campaign } = await heroInCampaign(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(campaign)
  await campaignTab(page, 'Rolls').click()
  const feed = page.getByRole('tabpanel', { name: 'Rolls' }).getByRole('list', { name: 'Rolls, newest first' })
  await expect(feed.getByRole('article').first()).toContainText(HERO)
  await shot(page, 'campaign-rolls-phone')
})
