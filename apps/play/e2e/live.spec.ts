import { test, expect, HERO, heroInCampaign, gotoLive, hpButton, historyRows, shot } from './fixtures'
import type { Page, WebSocketRoute } from '@playwright/test'

// The live channel between two tabs of the same account: Silas is V1 Campaign's GM and V1 Hero's owner, so one tab is
// the player's sheet and the other the GM's campaign page or GM view. Design 22; spec 15, 17, 19. Every test returns
// V1 Hero to 40 / 40 with no conditions or wounds.

const heroCard = (page: Page) => page.getByRole('link', { name: new RegExp(`^${HERO} `) })
const pad = (page: Page) => page.getByRole('region', { name: 'Damage and healing' })

async function damage(page: Page, amount: number, button: 'Damage' | 'Heal' = 'Damage') {
  const control = pad(page).getByRole('button', { name: button, exact: true })
  // Typing before the page has hydrated is lost (the button stays disabled), so type until the button enables.
  await page.waitForLoadState('networkidle').catch(() => {})
  try {
    await expect(async () => {
      await pad(page).getByRole('textbox', { name: 'Damage or heal' }).fill(String(amount))
      await expect(control).toBeEnabled({ timeout: 500 })
    }).toPass({ timeout: 10_000 })
  } catch (e) {
    await shot(page, `live-${button.toLowerCase()}-stayed-disabled`)
    throw e
  }
  await control.click()
}

async function addCondition(page: Page, title: string) {
  await page.getByRole('button', { name: 'Add a condition' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add a condition' })
  await dialog.getByRole('textbox', { name: 'Search conditions' }).fill(title)
  await dialog.getByRole('button', { name: new RegExp(`^${title}`) }).first().click()
  await expect(dialog).toBeHidden()
}

/** Heals 5 and waits until the server has the write (a reload still shows 40 / 40), so the next test starts from 40 / 40. */
async function healAndSettle(page: Page) {
  // The heal may queue behind an earlier write still in flight; wait for its own request to be answered before reloading.
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /"s":"heal"/.test(r.request().postData() ?? ''), { timeout: 15_000 })
  await damage(page, 5, 'Heal')
  await saved
  await expect(hpButton(page)).toHaveAccessibleName('HP 40 of 40. Open the damage pad')
  await expect(async () => {
    await page.reload()
    await expect(hpButton(page)).toHaveAccessibleName('HP 40 of 40. Open the damage pad', { timeout: 3_000 })
  }).toPass({ timeout: 15_000 })
}

/** Elapsed ms until `check` passes, polled every 50 ms; fails past `limit`. */
async function timeUntil(check: () => Promise<unknown>, limit: number): Promise<number> {
  const start = Date.now()
  await expect(async () => {
    await check()
  }).toPass({ intervals: [50], timeout: limit })
  return Date.now() - start
}

test('spec 17: 5 damage on the phone sheet reaches the GM campaign card ≤ 2 s; a wound the GM adds in the GM view reaches the sheet ≤ 2 s', async ({ page, openTab }) => {
  const { hero, campaign } = await heroInCampaign(page)
  const gm = await openTab()
  await gotoLive(gm, campaign)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoLive(page, hero)
  await expect(hpButton(page)).toHaveAccessibleName('HP 40 of 40. Open the damage pad')
  await expect(heroCard(gm).getByLabel('HP 40 of 40')).toBeVisible()

  await damage(page, 5)
  await expect(hpButton(page)).toHaveAccessibleName('HP 35 of 40. Open the damage pad')
  const toCard = await timeUntil(() => expect(heroCard(gm).getByLabel('HP 35 of 40')).toBeVisible({ timeout: 0 }), 2_000)
  test.info().annotations.push({ type: 'sheet → GM card (ms)', description: String(toCard) })
  await shot(gm, 'live-spec17-gm-card')

  // The GM adds a wound in the GM view; the player's sheet shows it.
  await gotoLive(gm, `${campaign}/gm`) // a click before hydration does not open the wound row
  await gm.getByRole('button', { name: 'Add a wound' }).click()
  await gm.getByRole('textbox', { name: 'Rank' }).fill('3')
  await gm.getByRole('textbox', { name: 'Description' }).fill('V1 live bruise')
  await gm.getByRole('button', { name: 'Add', exact: true }).click()
  const toSheet = await timeUntil(() => expect(page.getByText('V1 live bruise')).toBeVisible({ timeout: 0 }), 2_000)
  test.info().annotations.push({ type: 'GM view → sheet (ms)', description: String(toSheet) })
  await shot(page, 'live-spec17-sheet-wound')

  // Tidy on the sheet: remove the wound, heal 5.
  await page.getByRole('button', { name: 'Edit wound of rank 3' }).click()
  await page.getByRole('button', { name: 'Remove wound' }).click()
  await expect(page.getByText('V1 live bruise')).toHaveCount(0)
  await healAndSettle(page)
})

test('design 22: the player takes 5 while the GM tab is stale; the GM adds a condition → GM tab shows HP 35 and the condition; History has both in order', async ({ page, openTab }) => {
  const { hero, campaign } = await heroInCampaign(page)
  // The GM view's live channel is held open but never reaches the server, so it hears nothing: a stale tab.
  const gm = await openTab()
  await gm.routeWebSocket(/\/live$/, () => {})
  await gm.goto(`${campaign}/gm`)
  await expect(hpButton(gm)).toHaveAccessibleName('HP 40 of 40. Open the damage pad')
  await gm.waitForLoadState('networkidle').catch(() => {})

  await page.goto(hero)
  await damage(page, 5)
  await expect(hpButton(page)).toHaveAccessibleName('HP 35 of 40. Open the damage pad')
  await gm.waitForTimeout(1_500)
  await expect(hpButton(gm), 'the GM tab has not heard of the damage').toHaveAccessibleName('HP 40 of 40. Open the damage pad')

  await addCondition(gm, 'Dazed')
  await expect(hpButton(gm)).toHaveAccessibleName('HP 35 of 40. Open the damage pad')
  await expect(gm.getByRole('heading', { name: 'Conditions', level: 2 }).locator('xpath=ancestor::section[1]')).toContainText('Dazed')
  await shot(gm, 'live-22-gm-rebased')

  await page.reload()
  await expect.poll(async () => (await historyRows(page)).slice(0, 2).join(' | ')).toMatch(/^Changed a condition.* \| Took 5 damage/)

  // Tidy: remove Dazed, heal 5.
  await page.getByRole('button', { name: 'Remove Dazed' }).click()
  await expect(page.getByText('No conditions.')).toBeVisible()
  await healAndSettle(page)
})

test('spec 15: a roll on the sheet shows in the GM campaign page feed ≤ 2 s', async ({ page, openTab }) => {
  const { hero, campaign } = await heroInCampaign(page)
  const gm = await openTab()
  await gm.setViewportSize({ width: 1280, height: 900 })
  await gotoLive(gm, campaign)
  const feed = gm.getByRole('complementary').getByRole('list', { name: 'Rolls, newest first' })
  const before = (await feed.count()) ? await feed.getByRole('article').count() : 0

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(hero)
  await page.getByRole('button', { name: 'Roll Agility' }).click()
  const panel = page.getByRole('dialog', { name: 'Roll Agility' })
  await panel.getByRole('button', { name: 'Roll Agility check' }).click()
  const total = (await panel.getByLabel(/^Total \d+$/).getAttribute('aria-label'))!
  const elapsed = await timeUntil(async () => {
    await expect(feed.getByRole('article')).toHaveCount(Math.min(before + 1, 200), { timeout: 0 })
    await expect(feed.getByRole('article').first().getByLabel(total)).toBeVisible({ timeout: 0 })
  }, 2_000)
  test.info().annotations.push({ type: 'sheet roll → GM feed (ms)', description: String(elapsed) })
  await expect(feed.getByRole('article').first()).toContainText('Agility check')
  const fail = panel.getByRole('button', { name: 'Fail', exact: true })
  if (await fail.isVisible()) await fail.click()
  await shot(gm, 'live-spec15-feed')
})

test('spec 19: a dropped connection shows "Live updates paused — reconnecting"; on reconnect the page shows current data', async ({ page, openTab }) => {
  const { hero, campaign } = await heroInCampaign(page)
  // The GM campaign page's sockets: the first connects; reconnects wait at `gate` until the test lets them through.
  let first: WebSocketRoute | null = null
  let release = () => {}
  const gate = new Promise<void>((r) => (release = r))
  const gm = await openTab()
  await gm.routeWebSocket(/\/live$/, async (ws) => {
    if (first) await gate
    else first = ws
    ws.connectToServer()
  })
  await gotoLive(gm, campaign)
  await expect(heroCard(gm).getByLabel('HP 40 of 40')).toBeVisible()

  await first!.close()
  const notice = gm.getByRole('status').filter({ hasText: 'Live updates paused — reconnecting' })
  await expect(notice).toBeVisible()
  await shot(gm, 'live-spec19-paused')

  // While it is down, the player takes 5: the card cannot hear it.
  const player = page
  await player.goto(hero)
  await damage(player, 5)
  await expect(hpButton(player)).toHaveAccessibleName('HP 35 of 40. Open the damage pad')
  await gm.waitForTimeout(1_000)
  await expect(heroCard(gm).getByLabel('HP 40 of 40')).toBeVisible()

  release()
  await expect(notice).toHaveCount(0, { timeout: 10_000 })
  await expect(heroCard(gm).getByLabel('HP 35 of 40'), 'refetched on reconnect').toBeVisible()
  await shot(gm, 'live-spec19-reconnected')

  await healAndSettle(player)
})
