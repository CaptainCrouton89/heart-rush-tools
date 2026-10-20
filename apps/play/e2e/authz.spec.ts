import { test, expect, PLAY, campaignUrl, idFrom, shot } from './fixtures'

// From the browser, a campaign Silas is not a member of is refused: a forced server-function call, the page itself,
// and the live channel's WebSocket (spec criterion 18). With one account the only such campaign is an id that names no
// campaign of his; the server answers it the same way it answers a real campaign he is not in (`roleIn` finds no row).
// The player-vs-GM rows (design 23, spec 2/7/8/25) are server tests: apps/play/test/{campaigns,campaign-play,tools-api,ai}.test.ts.

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const randomUlid = () => Array.from({ length: 26 }, (_, i) => CROCKFORD[Math.floor(Math.random() * (i === 0 ? 8 : 32))]).join('')

test('forced server-function call for a campaign he is not in → refused with 403 forbidden', async ({ page }) => {
  const campaign = await campaignUrl(page)
  const own = idFrom(campaign)

  // Record the GET server-function calls the campaign page makes for his own campaign when it refetches. The first
  // load runs its loaders on the server, so set the day to the day it already is: the write invalidates the page.
  await page.goto(campaign)
  await page.waitForLoadState('networkidle').catch(() => {})
  const calls: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'GET' && r.url().includes('/_serverFn/') && decodeURIComponent(r.url()).includes(own)) calls.push(r.url())
  })
  const day = /Day (\d+)/.exec(await page.getByText(/^Day \d+$/).first().innerText())![1]!
  await page.getByRole('button', { name: 'Set day' }).click()
  await page.getByRole('textbox', { name: 'Day' }).fill(day)
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await expect.poll(() => calls.length, { message: 'the campaign page called a GET server function with its campaign id' }).toBeGreaterThan(0)
  await page.waitForLoadState('networkidle').catch(() => {})

  const recorded = [...new Set(calls)] // snapshot: the replays below are recorded too
  const other = randomUlid()
  for (const url of recorded) {
    const forced = url.replaceAll(own, other)
    // The same call his own page makes, from his own signed-in page, with only the campaign id changed.
    const own200 = await page.evaluate(async (u) => {
      const r = await fetch(u, { headers: { 'x-tsr-serverFn': 'true' } })
      return { status: r.status, body: await r.text() }
    }, url)
    const res = await page.evaluate(async (u) => {
      const r = await fetch(u, { headers: { 'x-tsr-serverFn': 'true' } })
      return { status: r.status, body: await r.text() }
    }, forced)
    test.info().annotations.push({ type: 'forced call', description: `${res.status} ${res.body.slice(0, 160)}` })
    expect(own200.body, 'his own campaign is readable through the same call').not.toContain('forbidden')
    expect(res.body).toContain('forbidden')
    expect(res.body).toContain('403')
    expect(res.body).not.toContain('V1 Campaign')
  }
})

test('the campaign page for a campaign he is not in shows "Campaign not found" and no campaign data', async ({ page }) => {
  await page.goto(`${PLAY}/campaigns/${randomUlid()}`)
  await expect(page.getByText('Campaign not found')).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Campaign' })).toHaveCount(0)
  await shot(page, 'authz-not-found')
})

test('spec 18: a WebSocket to the live channel of a campaign he is not in closes without opening', async ({ page }) => {
  const campaign = await campaignUrl(page)
  await page.goto(campaign)
  const result = await page.evaluate(
    (path) =>
      new Promise<{ opened: boolean; code: number }>((resolve) => {
        const ws = new WebSocket(new URL(path, location.href).href.replace(/^http/, 'ws'))
        let opened = false
        ws.onopen = () => {
          opened = true
          ws.close()
        }
        ws.onclose = (e) => resolve({ opened, code: e.code })
        setTimeout(() => resolve({ opened, code: -1 }), 10_000)
      }),
    `/campaigns/${randomUlid()}/live`,
  )
  test.info().annotations.push({ type: 'ws', description: JSON.stringify(result) })
  expect(result.opened).toBe(false)
  expect(result.code).not.toBe(-1)

  // Control: his own campaign's channel does open from the same page.
  const ownOpens = await page.evaluate(
    (path) =>
      new Promise<boolean>((resolve) => {
        const ws = new WebSocket(new URL(path, location.href).href.replace(/^http/, 'ws'))
        ws.onopen = () => {
          ws.close()
          resolve(true)
        }
        ws.onclose = () => resolve(false)
        setTimeout(() => resolve(false), 10_000)
      }),
    `/campaigns/${idFrom(campaign)}/live`,
  )
  expect(ownOpens, 'his own campaign channel opens').toBe(true)
})
