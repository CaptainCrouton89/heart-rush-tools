import { test as base, chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

/** The site under test and the signed-in browser the specs attach to. */
export const PLAY = process.env.PLAY_URL ?? 'https://play.heartrush.party'
export const TOOLS = process.env.TOOLS_URL ?? 'https://tools.heartrush.party'
const CDP = process.env.PLAY_CDP ?? 'http://localhost:9222'
/** Where failure screenshots go (default: the Playwright output dir). */
export const SHOTS = process.env.PLAY_E2E_SHOTS ?? 'test-results/shots'

/** Names of what the specs create on the account, so a run finds its own data again and a person can tell it apart. */
export const HERO = 'V1 Hero'
export const CAMPAIGN = 'V1 Campaign'

type Fixtures = {
  /** The signed-in browser context (the person's own profile). */
  signedIn: BrowserContext
  /** A fresh tab in the signed-in context, closed after the test. */
  page: Page
  /** Opens another tab in the signed-in context, closed after the test. */
  openTab: () => Promise<Page>
  /**
   * A context with no Heart Rush cookie but the Northlight account cookies copied in, so `/auth/login` signs in again
   * without a consent click. Its session is separate from the person's own: signing it out does not sign them out.
   */
  isolated: BrowserContext
}

export const test = base.extend<Fixtures, { cdp: Browser }>({
  cdp: [
    async ({}, use) => {
      const browser = await chromium.connectOverCDP(CDP)
      await use(browser)
      await browser.close() // disconnects only; the person's browser stays open
    },
    { scope: 'worker' },
  ],
  signedIn: async ({ cdp }, use) => {
    await use(cdp.contexts()[0])
  },
  openTab: async ({ signedIn }, use) => {
    const opened: Page[] = []
    await use(async () => {
      const p = await signedIn.newPage()
      // A click or keystroke that lands before the page hydrates is lost, so every navigation waits until the page's
      // scripts, fonts and loader calls have finished.
      const goto = p.goto.bind(p)
      p.goto = async (url, options) => {
        const response = await goto(url, options)
        await p.waitForLoadState('networkidle').catch(() => {})
        return response
      }
      opened.push(p)
      return p
    })
    for (const p of opened) await p.close().catch(() => {})
  },
  page: async ({ openTab }, use) => {
    await use(await openTab())
  },
  isolated: async ({ cdp, signedIn }, use) => {
    const northlight = (await signedIn.cookies()).filter((c) => /(^|\.)northlight\.ai$/.test(c.domain.replace(/^\./, '')))
    const ctx = await cdp.newContext()
    await ctx.addCookies(northlight)
    await use(ctx)
    await ctx.close()
  },
})

export { expect }

/**
 * Saves a full-page screenshot named after the test step, for a failure report. It is evidence, not a check: in the
 * attached browser a screenshot of a tab that is not in front can stall, so it gives up after 10 s.
 */
export async function shot(page: Page, name: string): Promise<string> {
  const path = `${SHOTS}/${name}.png`
  await page.screenshot({ path, fullPage: true, timeout: 10_000 }).catch(() => {})
  return path
}

/** The id at the end of a `/characters/$id` or `/campaigns/$id` URL. */
export function idFrom(url: string): string {
  const m = /\/(characters|campaigns)\/([0-9A-Z]{26})/.exec(url)
  if (!m) throw new Error(`no id in ${url}`)
  return m[2]!
}

/** The finished V1 Hero's sheet URL (the builder spec creates it). Fails when it does not exist yet. */
export async function heroUrl(page: Page): Promise<string> {
  await page.goto(`${PLAY}/characters`)
  const link = page.getByRole('link', { name: new RegExp(`^${HERO} HP`) })
  await expect(link, `run builder.spec.ts first: it finishes "${HERO}"`).toHaveCount(1)
  return new URL((await link.getAttribute('href'))!, PLAY).href
}

/** The V1 Campaign's URL, creating it when missing. */
export async function campaignUrl(page: Page): Promise<string> {
  await page.goto(`${PLAY}/campaigns`)
  const link = page.getByRole('link', { name: new RegExp(`^${CAMPAIGN} Day`) })
  if ((await link.count()) > 0) return new URL((await link.first().getAttribute('href'))!, PLAY).href
  await page.getByRole('button', { name: 'Create campaign' }).click()
  await page.getByRole('textbox', { name: 'Campaign name' }).fill(CAMPAIGN)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForURL(/\/campaigns\/[0-9A-Z]{26}$/)
  return page.url()
}

/** Puts V1 Hero in V1 Campaign (from the campaign page) when it is not there yet; returns both URLs. */
export async function heroInCampaign(page: Page): Promise<{ hero: string; campaign: string }> {
  const hero = await heroUrl(page)
  const campaign = await campaignUrl(page)
  await page.goto(campaign)
  const card = page.getByRole('link', { name: new RegExp(`^${HERO} `) })
  if ((await card.count()) === 0) {
    await page.getByRole('button', { name: 'Add my character to this campaign' }).click()
    await page.getByRole('button', { name: new RegExp(`^${HERO} `) }).click()
    await expect(card).toHaveCount(1)
  }
  return { hero, campaign }
}

/** The sticky bar's HP button on a sheet: "HP x of y. Open the damage pad". */
export const hpButton = (page: Page) => page.getByRole('button', { name: /^HP -?\d+ of \d+\. Open the damage pad/ })

/** The History section of a sheet (the More tab on a phone). */
export const historySection = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: 'History', level: 2 }) })

/** The visible text of every History row, newest first. */
export async function historyRows(page: Page): Promise<string[]> {
  return (await historySection(page).getByRole('listitem').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
}

/**
 * Opens a campaign or character page and waits until its live channel socket exists and the page has settled, so a
 * change made elsewhere afterwards reaches it (a page still hydrating has no socket yet and would miss the event).
 */
export async function gotoLive(page: Page, url: string): Promise<void> {
  const socket = page.waitForEvent('websocket', { predicate: (ws) => ws.url().endsWith('/live'), timeout: 15_000 })
  await page.goto(url)
  await socket
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)
}
