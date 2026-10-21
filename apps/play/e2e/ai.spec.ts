import { test, expect, PLAY, HERO, heroInCampaign, historyRows, historySection, shot } from './fixtures'
import type { Page } from '@playwright/test'

// Design criterion 24, its real-host halves: each AI feature (Explain an ability, Explain an aspect, Suggest talents, the
// GM assistant) returns a complete result on Silas's own runtime and writes nothing to the character (History is
// unchanged — production D1 is not reachable from here, so History stands for the character_event rows); **Add** on a
// suggestion produces exactly one "Bought <talent>" (xp:buy) row, which the test then undoes. The 403 halves (a
// player or an unrelated account forcing runAi) are server tests: apps/play/test/ai.test.ts.

const AI_TIMEOUT = 90_000

/** The top History rows and the character's revision-bearing HP line, to compare before and after an AI call. */
async function historyTop(page: Page): Promise<string> {
  await page.reload()
  await page.waitForLoadState('networkidle').catch(() => {})
  return (await historyRows(page)).slice(0, 3).join(' | ')
}

test('24: Explain an ability on the sheet → Summary, When to use, Cost, Example; History unchanged', async ({ page }) => {
  const { hero } = await heroInCampaign(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(hero)
  const before = await historyTop(page)

  await page.getByRole('button', { name: 'Explain Thundering Charge' }).click()
  const popover = page.getByRole('dialog').filter({ hasText: 'Explain · Thundering Charge' })
  await expect(popover.getByRole('definition').first()).toBeVisible({ timeout: AI_TIMEOUT })
  for (const term of ['Summary', 'When to use', 'Cost', 'Example']) {
    const dt = popover.getByRole('term').filter({ hasText: new RegExp(`^${term}$`) })
    await expect(dt).toHaveCount(1)
    await expect(dt.locator('xpath=following-sibling::dd[1]')).not.toBeEmpty()
  }
  await shot(page, 'ai-24-explain')
  await popover.getByRole('button', { name: 'Close' }).click()
  expect(await historyTop(page)).toBe(before)
})

test('24: Explain an aspect (builder step 5) → Summary, Spend DP on it when, Earn DP from it when, Example', async ({ page }) => {
  // The aspect explainer is offered in the builder, and step 5 opens only once kin, vitals and professions are done.
  // Open an unfinished V1 draft (only a draft says "Continue"), or make one when a run on fresh data has none
  // (builder.spec.ts finishes V1 Hero itself), then take it as far as step 5 and leave it there for the next run.
  await page.goto(`${PLAY}/characters`)
  const draft = page.getByRole('link', { name: /^V1 Hero.* Continue Draft$/ }).first()
  if ((await draft.count()) > 0) {
    await draft.click()
  } else {
    await page.goto(`${PLAY}/characters/new`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('textbox', { name: 'Name' }).fill('V1 Hero draft')
    await page.getByRole('textbox', { name: 'Dream' }).fill('To be explained')
    await page.getByRole('button', { name: 'Continue' }).click()
  }
  await page.waitForURL(/\/characters\/[0-9A-Z]{26}\/build/)
  await page.waitForLoadState('networkidle').catch(() => {}) // a step click before hydration does nothing
  const next = page.getByRole('button', { name: 'Continue' })
  const aspectsStep = page.getByRole('button', { name: '5 Aspects' })
  if (await page.getByRole('button', { name: '3 Vitals' }).isDisabled()) {
    await page.getByRole('searchbox', { name: 'Race' }).fill('Centaur')
    await page.getByRole('button', { name: /^Centaur / }).click()
    await next.click()
  }
  if (await aspectsStep.isDisabled()) {
    await page.getByRole('button', { name: '3 Vitals' }).click()
    for (const [ability, die] of [['Might', 'd6'], ['Agility', 'd6'], ['Cunning', 'd4'], ['Presence', 'd4']]) {
      await page.getByRole('radiogroup', { name: ability }).getByRole('radio', { name: die }).click()
    }
    await next.click()
  }
  if (await aspectsStep.isDisabled()) {
    await page.getByRole('button', { name: '4 Professions' }).click()
    if ((await page.getByRole('textbox', { name: 'Profession 1' }).count()) === 0) await page.getByRole('button', { name: 'Add a profession' }).click()
    await page.getByRole('textbox', { name: 'Profession 1' }).fill('Smith')
    const smithMore = page.getByRole('group', { name: 'Smith rank' }).getByRole('button', { name: 'One rank more' })
    await smithMore.click()
    await smithMore.click()
    await page.getByRole('button', { name: 'Add a profession' }).click()
    await page.getByRole('textbox', { name: 'Profession 2' }).fill('Cook')
    await expect(page.getByText('0 of 4 ranks left')).toBeVisible()
  }
  await page.getByRole('button', { name: '5 Aspects' }).click()
  await expect(page.getByRole('heading', { name: '5. Aspects', level: 1 })).toBeVisible()
  // The Explain buttons appear once the draft is complete enough to build a character, i.e. both written aspects are saved.
  for (const [i, text] of [['1', 'Chronic insomniac'], ['2', 'Owes the ferryman a favour']]) {
    const field = page.getByRole('textbox', { name: `Aspect ${i}` })
    if ((await field.inputValue()) === '') await field.fill(text)
  }
  await page.getByRole('button', { name: 'Explain the aspect Fury of the herd' }).click()
  const popover = page.getByRole('dialog').filter({ hasText: 'Explain · “Fury of the herd”' })
  await expect(popover.getByRole('definition').first()).toBeVisible({ timeout: AI_TIMEOUT })
  for (const term of ['Summary', 'Spend DP on it when', 'Earn DP from it when', 'Example']) {
    const dt = popover.getByRole('term').filter({ hasText: new RegExp(`^${term}$`) })
    await expect(dt).toHaveCount(1)
    await expect(dt.locator('xpath=following-sibling::dd[1]')).not.toBeEmpty()
  }
  await shot(page, 'ai-24-explain-aspect')
})

test('24: Suggest talents → priced cards; History unchanged; Add → exactly one "Bought …" row; undone after', async ({ page }) => {
  const { hero } = await heroInCampaign(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${hero}/advance`)
  const before = await historyTop(page)

  const suggested = page.getByRole('region', { name: 'Suggested talents' })
  await suggested.getByRole('button', { name: 'Suggest talents for my concept' }).click()
  const cards = suggested.getByRole('listitem')
  await expect(cards.first()).toBeVisible({ timeout: AI_TIMEOUT })
  const count = await cards.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i).getByRole('heading', { level: 3 })).not.toBeEmpty()
    await expect(cards.nth(i)).toContainText(/\d+ XP/)
  }
  await shot(page, 'ai-24-suggest')
  expect(await historyTop(page), 'suggesting wrote nothing').toBe(before)

  // Re-run (the reload dropped the in-memory result) and Add the first affordable suggestion that needs no element.
  await suggested.getByRole('button', { name: 'Suggest talents for my concept' }).click()
  await expect(cards.first()).toBeVisible({ timeout: AI_TIMEOUT })
  const addable = cards.filter({ has: page.getByRole('button', { name: 'Add', exact: true, disabled: false }) }).filter({ hasNot: page.getByRole('combobox') })
  await expect(addable.first(), 'a suggestion that can be added').toBeVisible()
  const title = await addable.first().getByRole('heading', { level: 3 }).innerText()
  // "Added" shows before the write lands; a reload then would cancel it, so wait for the xp:buy POST to answer first.
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /xp:buy/.test(r.request().postData() ?? ''), { timeout: 15_000 })
  await addable.first().getByRole('button', { name: 'Add', exact: true }).click()
  await expect(suggested.getByRole('listitem').filter({ hasText: title }).getByRole('button', { name: 'Added' })).toBeVisible()
  expect((await saved).ok(), 'the xp:buy write succeeded').toBe(true)

  await page.reload()
  await page.waitForLoadState('networkidle').catch(() => {})
  const rows = await historyRows(page)
  expect(rows[0]).toMatch(new RegExp(`^Bought ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  // Only the newest row carries an Undo button, so compare rows without it.
  const bare = (r: string) => r.replace(/ Undo$/, '')
  expect(rows.slice(1, 3).map(bare), 'exactly one new row above the old top').toEqual(before.split(' | ').slice(0, 2).map(bare))
  await shot(page, 'ai-24-added')

  // Tidy: undo the purchase.
  await historySection(page).getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await historyRows(page))[0]).toMatch(/^Undid: Bought/)
})

test('24: GM assistant answers a suggested question on the campaign page; History unchanged', async ({ page }) => {
  const { hero, campaign } = await heroInCampaign(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(hero)
  const before = await historyTop(page)

  await page.goto(campaign)
  const panel = page.getByRole('region', { name: 'Ask the GM assistant' })
  await panel.getByRole('list', { name: 'Suggested questions' }).getByRole('button', { name: 'Who is closest to going down?' }).click()
  const answer = panel.locator('[aria-live="polite"]').locator('p').first()
  await expect(answer).not.toBeEmpty({ timeout: AI_TIMEOUT })
  await expect(answer).not.toHaveText('')
  await shot(page, 'ai-24-gm-assistant')

  await page.goto(hero)
  expect(await historyTop(page)).toBe(before)
  void HERO
})
