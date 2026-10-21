import { test, expect, PLAY, idFrom, shot } from './fixtures'
import type { Locator, Page } from '@playwright/test'

// The character-creation assistant (spec "Acceptance" 1, 3, 9, 14; design "Acceptance → test"), against the real host
// with the signed-in browser's own Northlight connection. A reply is a real hosted run: 30–90 s. Drafts these tests
// make are named "V1 Assistant …" (play has no way to delete a draft, so they stay on the account).
// Acceptances 2 and 5–8 and 10 need a person's eye on the reply and are checked by hand; the rest are node tests.

const REPLY = 150_000
const BEETLE = 'I want to play someone who rides a beetle'
const RULES = 'https://rules.heartrush.party/'

const composer = (page: Page) => page.getByRole('textbox', { name: 'Message to the assistant' })
const conversation = (page: Page) => page.locator('ol[aria-label="Conversation"] > li')
const thinking = (page: Page) => page.getByRole('status').filter({ hasText: 'Thinking…' })
const characterIdOf = (page: Page) => idFrom(page.url())

/** Types into the composer and sends with its Send button. */
async function send(page: Page, text: string) {
  await composer(page).fill(text)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
}

/** Starts a draft from `/characters/new` with a name typed (so the draft is findable), sends the beetle line, lands on its builder. */
async function startNamed(page: Page, name: string) {
  await page.goto(`${PLAY}/characters/new`)
  await page.getByRole('textbox', { name: 'Name' }).fill(name)
  await send(page, BEETLE)
  await page.waitForURL(/\/characters\/[0-9A-Z]{26}\/build/, { timeout: 30_000 })
  await page.waitForLoadState('networkidle').catch(() => {})
}

/** Waits until the assistant's newest turn is on screen and no run is in flight; returns that turn. */
async function reply(page: Page, count: number): Promise<Locator> {
  await expect(conversation(page)).toHaveCount(count, { timeout: REPLY })
  await expect(thinking(page)).toHaveCount(0, { timeout: REPLY })
  return conversation(page).last()
}

/** The option buttons of a turn's decision: every button above the You decide / See all pair. */
const optionLinks = (turn: Locator) => turn.getByRole('link', { name: 'Rules ↗' })

/** The Name, Pronouns and Dream fields and the chosen race, as the builder shows them (step 1 and step 2). */
async function builderFields(page: Page): Promise<string> {
  await page.getByRole('button', { name: /^1 Dream/ }).click()
  const step1 = [await page.getByRole('textbox', { name: 'Name' }).inputValue(), await page.getByRole('textbox', { name: 'Pronouns' }).inputValue(), await page.getByRole('textbox', { name: 'Dream' }).inputValue()]
  await page.getByRole('button', { name: /^2 / }).click()
  const races = await page.getByRole('list', { name: 'Races' }).getByRole('button', { name: /./ }).evaluateAll((els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true').map((e) => e.textContent ?? ''))
  return JSON.stringify([...step1, races])
}

test('assistant 1: the beetle line on /characters/new with no name makes an unnamed draft, opens its builder with the chat, and asks one decision with 2–4 linked options plus You decide', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${PLAY}/characters/new`)
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('')
  await send(page, BEETLE)
  await page.waitForURL(/\/characters\/[0-9A-Z]{26}\/build/, { timeout: 30_000 })
  const id = characterIdOf(page)
  await expect(page.getByRole('region', { name: 'Character assistant' })).toBeVisible()

  const turn = await reply(page, 2)
  await shot(page, 'assistant-1-reply')
  const links = optionLinks(turn)
  const n = await links.count()
  expect(n, 'between 2 and 4 options, each with a rules link').toBeGreaterThanOrEqual(2)
  expect(n).toBeLessThanOrEqual(4)
  for (let i = 0; i < n; i++) expect(await links.nth(i).getAttribute('href')).toMatch(new RegExp(`^${RULES.replace(/[./]/g, '\\$&')}`))
  await expect(turn.getByRole('button', { name: 'You decide' })).toBeVisible()
  // The options are the buttons above the links' sentences: as many option buttons as links, besides You decide / See all.
  const buttons = await turn.getByRole('button').allInnerTexts()
  expect(buttons.filter((b) => b !== 'You decide' && !/^See all/.test(b) && !/^Apply$/.test(b) && b !== '×').length).toBeGreaterThanOrEqual(n)

  await page.goto(`${PLAY}/characters`)
  await expect(page.locator(`a[href="/characters/${id}/build"]`)).toContainText('Unnamed character')

  // Name it so a person can tell it from the others.
  await page.goto(`${PLAY}/characters/${id}/build`)
  await page.getByRole('textbox', { name: 'Name' }).fill('V1 Assistant beetle')
  await expect(page.getByText('Draft saved')).toBeVisible()
})

test('assistant 3: tapping an option changes nothing in the draft; after a reload the builder fields are the same', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await startNamed(page, 'V1 Assistant tap')
  const first = await reply(page, 2)
  const before = await builderFields(page)

  const options = first.getByRole('list').getByRole('button').filter({ hasNotText: /^(You decide|See all)/ })
  const label = (await options.first().innerText()).trim()
  await options.first().click()
  await expect(conversation(page).nth(2)).toContainText(label)
  const second = await reply(page, 4)
  await shot(page, 'assistant-3-after-tap')
  expect(second).toBeTruthy()
  expect(await builderFields(page), 'the tap and its reply wrote nothing').toBe(before)

  await page.reload()
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(conversation(page)).toHaveCount(4)
  expect(await builderFields(page), 'nothing written after a reload either').toBe(before)
})

test('assistant 9: reloading during a run shows Thinking… again and then the same reply; Stop ends a run and the draft is unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  // Reload the moment the run is in flight (a run can answer within seconds, so no waiting for the page to settle first).
  await page.goto(`${PLAY}/characters/new`)
  await page.getByRole('textbox', { name: 'Name' }).fill('V1 Assistant reload')
  await send(page, BEETLE)
  await page.waitForURL(/\/characters\/[0-9A-Z]{26}\/build/, { timeout: 30_000 })
  await expect(thinking(page)).toBeVisible()
  await page.reload({ waitUntil: 'commit' })
  await expect(thinking(page), 'the same run, adopted after the reload').toBeVisible()
  await shot(page, 'assistant-9-thinking-after-reload')
  await reply(page, 2)
  await expect(conversation(page).last()).not.toBeEmpty()

  // Stop: a second message, then Stop before it answers.
  const before = await builderFields(page)
  // Stop once the server has taken the message and started the run (a Stop sent before that finds nothing to stop).
  const sent = page.waitForResponse((r) => r.request().method() === 'POST' && /_serverFn/.test(r.url()) && /"message"/.test(r.request().postData() ?? ''))
  await send(page, 'Actually, what about a goblin rider?')
  await sent
  await expect(thinking(page)).toBeVisible()
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect(page.getByText('Stopped. Nothing in the draft changed.')).toBeVisible({ timeout: 60_000 })
  await expect(thinking(page)).toHaveCount(0)
  expect(await builderFields(page)).toBe(before)
  await page.reload()
  await page.waitForLoadState('networkidle').catch(() => {})
  expect(await builderFields(page), 'still unchanged after a reload').toBe(before)
})

test('assistant 14: at 390 px Builder and Assistant are two tabs; a reply arriving while Builder shows puts a dot on Assistant', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${PLAY}/characters/new`)
  await page.getByRole('textbox', { name: 'Name' }).fill('V1 Assistant phone')
  const tabs = page.getByRole('tablist', { name: 'Builder or assistant' })
  await expect(tabs.getByRole('tab', { name: 'Builder' })).toBeVisible()
  await expect(tabs.getByRole('tab', { name: 'Assistant' })).toBeVisible()
  await tabs.getByRole('tab', { name: 'Assistant' }).click()
  await send(page, BEETLE)
  await page.waitForURL(/\/characters\/[0-9A-Z]{26}\/build/, { timeout: 30_000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await expect(thinking(page)).toBeVisible()

  await tabs.getByRole('tab', { name: 'Builder' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const assistantTab = tabs.getByRole('tab', { name: /^Assistant/ })
  await expect(assistantTab).toContainText('new reply', { timeout: REPLY })
  await shot(page, 'assistant-14-dot')
  await assistantTab.click()
  await expect(assistantTab).not.toContainText('new reply')
  await expect(conversation(page)).toHaveCount(2)
})
