import { test, expect, PLAY, HERO, shot } from './fixtures'
import type { Page } from '@playwright/test'

// Design criterion 19, and it finishes the "V1 Hero" character every later spec uses.
// Centaur (no subrace, no choices), adult: 4 profession ranks, at most 3 in one profession.

const dieChoice = (page: Page, ability: string, die: 'd6' | 'd4') => page.getByRole('radiogroup', { name: ability }).getByRole('radio', { name: die })
const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue' })

test('19: step 3 refuses until two d6 and two d4; step 4 refuses more than 4 ranks and more than 3 in one profession; Finish makes V1 Hero', async ({ page }) => {
  // A finished V1 Hero (its card shows HP) from an earlier run: build a second one under another name instead.
  await page.goto(`${PLAY}/characters`)
  const finished = (await page.getByRole('link', { name: new RegExp(`^${HERO} HP`) }).count()) > 0

  // Step 1 → draft row, step 2. Wait for hydration so typing reaches React's state.
  await page.goto(`${PLAY}/characters/new`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('textbox', { name: 'Name' }).fill(finished ? `${HERO} draft` : HERO)
  await page.getByRole('textbox', { name: 'Dream' }).fill('To press every button once')
  await continueButton(page).click()
  await page.waitForURL(/\/characters\/[0-9A-Z]{26}\/build/)

  // Step 2: steps 3+ are closed until a race is chosen.
  await expect(page.getByRole('button', { name: '3 Vitals' })).toBeDisabled()
  await page.getByRole('searchbox', { name: 'Race' }).fill('Centaur')
  await page.getByRole('button', { name: /^Centaur / }).click()
  await continueButton(page).click()

  // Step 3: refused until exactly two d6 and two d4.
  await expect(page.getByRole('heading', { name: '3. Vitals', level: 1 })).toBeVisible()
  await expect(continueButton(page)).toBeDisabled()
  await expect(page.getByRole('button', { name: '4 Professions' })).toBeDisabled()
  await expect(page.getByText('Assign exactly two d6 and two d4 (now 0 d6 and 0 d4).')).toBeVisible()
  await dieChoice(page, 'Might', 'd6').click()
  await dieChoice(page, 'Agility', 'd6').click()
  // A third d6 cannot be picked.
  await expect(dieChoice(page, 'Cunning', 'd6')).toBeDisabled()
  await dieChoice(page, 'Cunning', 'd4').click()
  await expect(continueButton(page)).toBeDisabled()
  await expect(page.getByText('Assign exactly two d6 and two d4 (now 2 d6 and 1 d4).')).toBeVisible()
  await dieChoice(page, 'Presence', 'd4').click()
  await expect(page.getByRole('radiogroup', { name: 'Age' }).getByRole('radio', { name: 'Adult' })).toBeChecked()
  await expect(continueButton(page)).toBeEnabled()
  await continueButton(page).click()

  // Step 4: at most 3 in one profession, 4 in total.
  await expect(page.getByRole('heading', { name: '4. Professions', level: 1 })).toBeVisible()
  await expect(page.getByText('No profession may have more than 3 ranks.', { exact: false })).toBeVisible()
  if ((await page.getByRole('textbox', { name: 'Profession 1' }).count()) === 0) await page.getByRole('button', { name: 'Add a profession' }).click()
  await page.getByRole('textbox', { name: 'Profession 1' }).fill('Smith')
  const smithMore = page.getByRole('group', { name: 'Smith rank' }).getByRole('button', { name: 'One rank more' })
  await smithMore.click()
  await smithMore.click()
  await expect(page.getByRole('group', { name: 'Smith rank' })).toContainText('3')
  await expect(smithMore, 'a 4th rank in one profession is refused').toBeDisabled()
  await expect(continueButton(page)).toBeDisabled()
  await expect(page.getByText('Profession ranks must add up to 4 (now 3).')).toBeVisible()
  await page.getByRole('button', { name: 'Add a profession' }).click()
  await page.getByRole('textbox', { name: 'Profession 2' }).fill('Cook')
  await expect(page.getByText('0 of 4 ranks left')).toBeVisible()
  const cookMore = page.getByRole('group', { name: 'Cook rank' }).getByRole('button', { name: 'One rank more' })
  await expect(cookMore, 'a 5th rank in total is refused').toBeDisabled()
  await expect(page.getByRole('button', { name: 'Add a profession' }), 'no room for another profession').toBeDisabled()
  await shot(page, 'builder-19-step4-caps')
  await continueButton(page).click()

  // Steps 5–7, then Finish.
  await page.getByRole('textbox', { name: 'Aspect 1' }).fill('Chronic insomniac')
  await page.getByRole('textbox', { name: 'Aspect 2' }).fill('Owes the ferryman a favour')
  await continueButton(page).click()
  await expect(page.getByRole('heading', { name: '6. Talents', level: 1 })).toBeVisible()
  await continueButton(page).click()
  await expect(page.getByRole('heading', { name: '7. Gear', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Finish' }).click()
  await page.waitForURL(/\/characters\/[0-9A-Z]{26}$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(finished ? `${HERO} draft` : HERO)
  await expect(page.getByRole('button', { name: 'HP 40 of 40. Open the damage pad' })).toBeVisible()
})
