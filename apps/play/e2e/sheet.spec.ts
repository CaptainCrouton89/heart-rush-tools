import { test, expect, heroUrl, hpButton, historyRows, historySection, shot } from './fixtures'
import type { Locator, Page } from '@playwright/test'

// Design criteria 20 and 21, and spec criterion 21 (profession progress, advance, undo), on V1 Hero
// (Centaur: Thundering Charge is a major ability, so it has a Use button; Cook is rank 1).

/** The tap area of a control: its own box, or the larger box its ::after hit-area extension draws (design: ≥ 44 × 44). */
async function tapArea(control: Locator): Promise<{ box: { width: number; height: number }; tap: { width: number; height: number } }> {
  return control.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const after = getComputedStyle(el, '::after')
    const px = (v: string) => (v.endsWith('px') ? parseFloat(v) : 0)
    const positioned = after.content !== 'none' && after.position === 'absolute'
    return {
      box: { width: r.width, height: r.height },
      tap: { width: Math.max(r.width, positioned ? px(after.width) : 0), height: Math.max(r.height, positioned ? px(after.height) : 0) },
    }
  })
}

async function openTab(page: Page, name: string) {
  const tab = page.getByRole('tablist', { name: 'Sheet sections' }).getByRole('tab', { name })
  if (await tab.isVisible()) await tab.click()
}

test('20: at 390 px the Damage, Heal, Use, Next round and End fight controls are ≥ 44 × 44, no horizontal scroll, sticky bar always visible', async ({ page }) => {
  const url = await heroUrl(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url)
  await expect(hpButton(page)).toBeVisible()

  const controls: Record<string, Locator> = {
    Damage: page.getByRole('region', { name: 'Damage and healing' }).getByRole('button', { name: 'Damage', exact: true }),
    Heal: page.getByRole('region', { name: 'Damage and healing' }).getByRole('button', { name: 'Heal', exact: true }),
    'Next round': page.getByRole('button', { name: 'Next round' }),
    'End fight': page.getByRole('button', { name: 'End fight' }),
  }
  const measured: Record<string, unknown> = {}
  for (const [name, control] of Object.entries(controls)) {
    await control.scrollIntoViewIfNeeded()
    const m = await tapArea(control)
    measured[name] = m
    expect.soft(m.tap.width, `${name} tap width`).toBeGreaterThanOrEqual(44)
    expect.soft(m.tap.height, `${name} tap height`).toBeGreaterThanOrEqual(44)
  }
  await openTab(page, 'Abilities')
  const use = page.getByRole('button', { name: 'Use Thundering Charge' })
  await use.scrollIntoViewIfNeeded()
  measured.Use = await tapArea(use)
  expect.soft((measured.Use as Awaited<ReturnType<typeof tapArea>>).tap.width, 'Use tap width').toBeGreaterThanOrEqual(44)
  expect.soft((measured.Use as Awaited<ReturnType<typeof tapArea>>).tap.height, 'Use tap height').toBeGreaterThanOrEqual(44)
  test.info().annotations.push({ type: 'measured', description: JSON.stringify(measured) })

  // No horizontal scroll on any tab.
  for (const tab of ['Sheet', 'Abilities', 'Gear', 'Aspects', 'More']) {
    await openTab(page, tab)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect.soft(overflow, `horizontal overflow on the ${tab} tab`).toBeLessThanOrEqual(0)
  }

  // The sticky bar (name, heart die, HP) stays in view at the top, middle and bottom of the longest tab.
  await openTab(page, 'More')
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (const y of [0, height / 2, height]) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(150)
    await expect.soft(page.getByRole('button', { name: 'V1 Hero: pages' })).toBeInViewport()
    await expect.soft(page.getByLabel(/^Heart die d\d+$/)).toBeInViewport()
    await expect.soft(hpButton(page)).toBeInViewport()
  }
  await shot(page, 'sheet-20-phone-bottom')
})

test('21: Damage 12 → wound prompt → Mark → 28 / 28 and the wound; Undo → 40 / 40 and no wound; History lists both', async ({ page }) => {
  const url = await heroUrl(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(url)
  await expect(hpButton(page)).toHaveAccessibleName('HP 40 of 40. Open the damage pad')

  const pad = page.getByRole('region', { name: 'Damage and healing' })
  await pad.getByRole('textbox', { name: 'Damage or heal' }).fill('12')
  await pad.getByRole('button', { name: 'Damage', exact: true }).click()
  // The wound prompt is a strip inside the pad (restyle stage 2 replaced the dialog); nothing applies until Mark.
  await expect(pad.getByText('12 damage leaves a wound of rank 12. Max HP 40 → 28 until it heals.')).toBeVisible()
  await expect(hpButton(page)).toHaveAccessibleName('HP 40 of 40. Open the damage pad')
  await pad.getByRole('textbox', { name: 'Describe the wound' }).fill('V1 cracked rib')
  await pad.getByRole('button', { name: 'Mark' }).click()

  await expect(hpButton(page)).toHaveAccessibleName('HP 28 of 28. Open the damage pad')
  await expect(page.getByRole('button', { name: 'Edit wound of rank 12' })).toBeVisible()
  await expect(page.getByText('V1 cracked rib')).toBeVisible()
  await shot(page, 'sheet-21-wounded')

  const chip = page.getByRole('status').filter({ has: page.getByRole('button', { name: 'Undo' }) })
  await chip.getByRole('button', { name: 'Undo' }).click()
  await expect(hpButton(page)).toHaveAccessibleName('HP 40 of 40. Open the damage pad')
  await expect(page.getByRole('button', { name: /^Edit wound of rank/ })).toHaveCount(0)
  await expect(page.getByText('No wounds.')).toBeVisible()

  await expect.poll(async () => (await historyRows(page)).slice(0, 2).join(' | ')).toMatch(/^Undid: Took 12, wound added.* \| Took 12, wound added/)
})

test('spec 21: Advance is disabled until challenges, mission and practice are met; advancing resets counters; undo restores them', async ({ page }) => {
  const url = await heroUrl(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(url)
  const cook = page.getByRole('heading', { name: 'Cook', level: 3 }).locator('xpath=ancestor::li[1]')
  await expect(cook).toContainText('Novice → Apprentice')
  // Rank 1 → 2: 3 challenges, no mission, 4 weeks of practice (Experience_&_Advancement.md).
  await expect(cook).toContainText('0 / 3')
  await expect(cook).toContainText('not required')
  await expect(cook).toContainText('0 / 4 weeks')
  const advance = cook.getByRole('button', { name: 'Advance to rank 2' })
  await expect(advance).toBeDisabled()

  const challenge = cook.getByRole('button', { name: 'Add a challenge to Cook' })
  for (let i = 1; i <= 3; i++) {
    await challenge.click()
    await expect(cook).toContainText(`${i} / 3`)
  }
  await expect(advance, 'practice still owed').toBeDisabled()
  const practice = cook.getByRole('button', { name: 'Add a week of practice to Cook' })
  for (let i = 1; i <= 4; i++) {
    await practice.click()
    await expect(cook).toContainText(`${i} / 4 weeks`)
  }
  await expect(advance).toBeEnabled()
  await advance.click()
  await expect(cook).toContainText('Apprentice → Journeyman')
  await expect(cook).toContainText('0 / 4') // rank 2 → 3 needs 4 challenges
  await expect(cook).toContainText('0 / 9 weeks')
  await expect(cook).toContainText('required')
  await shot(page, 'sheet-spec21-advanced')

  const chip = page.getByRole('status').filter({ has: page.getByRole('button', { name: 'Undo' }) })
  await chip.getByRole('button', { name: 'Undo' }).click()
  await expect(cook).toContainText('Novice → Apprentice')
  await expect(cook).toContainText('3 / 3')
  await expect(cook).toContainText('4 / 4 weeks')
  await expect(cook.getByRole('button', { name: 'Advance to rank 2' })).toBeEnabled()

  // Tidy: undo the seven counter events from the top of History (practice ×4, then challenge ×3) so Cook is back at 0.
  const history = historySection(page)
  const after = [
    ...[3, 2, 1, 0].map((w) => `3 / 3.*${w} / 4 weeks`),
    ...[2, 1, 0].map((c) => `${c} / 3.*0 / 4 weeks`),
  ]
  for (const state of after) {
    await history.getByRole('button', { name: 'Undo' }).click()
    await expect(cook).toContainText(new RegExp(state))
  }
})
