import { test, expect, heroInCampaign, historyRows, shot } from './fixtures'
import type { Page } from '@playwright/test'

// Spec criteria 22 and 23: a private journal entry never reaches the campaign page (neither on screen nor in any
// server-function response the page loads); shared, it appears under the open session; unshared, it is gone again.
// Writing it adds nothing to the character's History (no character_event, so no revision change).

const journal = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: 'Journal', level: 2 }) })
const campaignTab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Campaign' }).getByRole('tab', { name })

/** Loads the campaign page's Sessions tab and returns the server-rendered page and every server-function response it read. */
async function loadSessions(page: Page, campaign: string): Promise<string[]> {
  const bodies: Promise<string>[] = []
  const listen = (r: import('@playwright/test').Response) => {
    if (r.url().includes('/_serverFn/') || r.request().isNavigationRequest()) bodies.push(r.text().catch(() => ''))
  }
  page.on('response', listen)
  await page.goto(campaign)
  await page.waitForLoadState('networkidle').catch(() => {})
  await campaignTab(page, 'Sessions').click()
  page.off('response', listen)
  return Promise.all(bodies)
}

test('spec 22 + 23: private entry not on the campaign page; Share → under the open session; unshare → removed; History unchanged', async ({ page, openTab }) => {
  const { hero, campaign } = await heroInCampaign(page)
  const text = `V1 secret plan ${Date.now()}`
  await page.setViewportSize({ width: 1280, height: 900 })

  // An open session to file the shared entry under.
  const gm = await openTab()
  await gm.setViewportSize({ width: 1280, height: 900 })
  await gm.goto(campaign)
  await campaignTab(gm, 'Sessions').click()
  if (!(await gm.getByRole('button', { name: /^End session \d+$/ }).isVisible())) {
    await gm.getByRole('button', { name: 'Start session' }).click()
  }
  const end = gm.getByRole('button', { name: /^End session \d+$/ })
  await expect(end).toBeVisible()
  const n = Number((await end.innerText()).replace('End session ', ''))

  await page.goto(hero)
  await page.waitForLoadState('networkidle').catch(() => {})
  // An earlier failed run's entries.
  const old = journal(page).getByRole('listitem').filter({ hasText: /V1 secret plan/ })
  while ((await old.count()) > 0) {
    await old.first().getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('dialog', { name: 'Delete this entry?' }).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('dialog', { name: 'Delete this entry?' })).toBeHidden()
  }
  const historyBefore = (await historyRows(page))[0]
  await journal(page).getByRole('button', { name: 'New entry' }).click()
  await page.getByRole('textbox', { name: 'New journal entry' }).fill(text)
  await page.getByRole('button', { name: 'Add entry' }).click()
  const entry = journal(page).getByRole('listitem').filter({ hasText: text })
  await expect(entry).toBeVisible()
  const share = entry.getByRole('switch', { name: 'Share with campaign' })
  await expect(share).toHaveAttribute('aria-checked', 'false')

  // Spec 23: no History row for the entry.
  await page.reload()
  await expect.poll(async () => (await historyRows(page))[0]).toBe(historyBefore)

  // Private: absent from the campaign page and from every response it loaded.
  let bodies = await loadSessions(gm, campaign)
  expect(bodies.some((b) => b.includes('V1 Hero')), 'the captured responses carry the campaign data').toBe(true)
  expect(bodies.filter((b) => b.includes(text))).toEqual([])
  await expect(gm.getByText(text)).toHaveCount(0)

  // Shared: under the open session.
  await journal(page).getByRole('listitem').filter({ hasText: text }).getByRole('switch', { name: 'Share with campaign' }).click()
  await expect(journal(page).getByRole('listitem').filter({ hasText: text }).getByRole('switch', { name: 'Share with campaign' })).toHaveAttribute('aria-checked', 'true')
  const session = gm.getByRole('article', { name: new RegExp(`^Session ${n}(Open)?$`) })
  await expect(session.getByRole('list', { name: 'Shared journal entries' }).getByText(text)).toBeVisible({ timeout: 5_000 })
  await shot(gm, 'journal-spec22-shared')

  // Unshared: removed again, and not in any response.
  await journal(page).getByRole('listitem').filter({ hasText: text }).getByRole('switch', { name: 'Share with campaign' }).click()
  await expect(journal(page).getByRole('listitem').filter({ hasText: text }).getByRole('switch', { name: 'Share with campaign' })).toHaveAttribute('aria-checked', 'false')
  await expect(gm.getByText(text)).toHaveCount(0, { timeout: 5_000 })
  bodies = await loadSessions(gm, campaign)
  expect(bodies.filter((b) => b.includes(text))).toEqual([])

  // Tidy: delete the entry, end the session.
  await journal(page).getByRole('listitem').filter({ hasText: text }).getByRole('button', { name: 'Delete' }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete this entry?' })
  await confirm.getByRole('button', { name: 'Delete' }).click()
  await expect(journal(page).getByText(text)).toHaveCount(0)
  await gm.getByRole('button', { name: `End session ${n}` }).click()
  await expect(gm.getByRole('button', { name: `End session ${n}` })).toHaveCount(0)
})
