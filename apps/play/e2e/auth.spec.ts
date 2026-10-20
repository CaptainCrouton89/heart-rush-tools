import { test, expect, PLAY, TOOLS, shot } from './fixtures'

// Design criterion 17 and spec criterion 24 (shared sign-in/out with tools.heartrush.party).
// `isolated` is a context with no Heart Rush cookie but the person's Northlight cookies, so it is a signed-out visitor
// whose sign-in completes without a consent click — and whose session is its own, so signing it out on tools does not
// sign the person out of their own browser.

test('17: /characters signed out redirects to /auth/login and lands back on /characters after sign-in', async ({ isolated }) => {
  const page = await isolated.newPage()
  const navigations: { status: number; url: string }[] = []
  page.on('response', (r) => {
    if (r.request().isNavigationRequest() && r.request().frame() === page.mainFrame()) navigations.push({ status: r.status(), url: r.url() })
  })
  await page.goto(`${PLAY}/characters`)
  await page.waitForURL(`${PLAY}/characters`)
  await expect(page.getByRole('heading', { name: 'Characters', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await shot(page, 'auth-17-landed')

  const urls = navigations.map((n) => n.url)
  expect(navigations[0]).toMatchObject({ url: `${PLAY}/characters` })
  expect([302, 303, 307]).toContain(navigations[0]!.status)
  expect(urls).toContain(`${PLAY}/auth/login?returnTo=%2Fcharacters`)
  expect(urls.some((u) => u.startsWith(`${PLAY}/auth/callback?`))).toBe(true)
  expect(navigations.at(-1)).toEqual({ status: 200, url: `${PLAY}/characters` })
})

test('spec 24: signed in on play → tools shows the same user; sign out on tools → play is signed out', async ({ isolated }) => {
  const page = await isolated.newPage()
  await page.goto(`${PLAY}/characters`)
  await page.waitForURL(`${PLAY}/characters`)
  const name = (await page.getByRole('banner').innerText()).match(/\n([^\n]+)\nSign out/)?.[1]?.trim()
  expect(name, 'the header shows the signed-in name before Sign out').toBeTruthy()

  // No second consent: tools renders signed in straight away on the shared cookie.
  const tools = await isolated.newPage()
  const toolsNavs: string[] = []
  tools.on('request', (r) => r.isNavigationRequest() && toolsNavs.push(r.url()))
  await tools.goto(`${TOOLS}/`)
  await expect(tools.getByRole('banner').getByText(name!, { exact: true })).toBeVisible()
  await expect(tools.getByRole('banner').getByRole('button', { name: 'Sign out' })).toBeVisible()
  expect(toolsNavs.filter((u) => u.includes('northlight.ai'))).toEqual([])

  await tools.getByRole('banner').getByRole('button', { name: 'Sign out' }).click()
  await tools.waitForLoadState('load')
  await shot(tools, 'auth-24-tools-signed-out')

  // Signed out: the shared cookie is gone and play answers /characters with the sign-in redirect. (Following that
  // redirect would sign this context in again through Northlight, so the check stops at the first response.)
  expect((await isolated.cookies(PLAY)).filter((c) => c.name === 'hr_session' && c.value)).toEqual([])
  const response = await page.request.get(`${PLAY}/characters`, { maxRedirects: 0 })
  expect([302, 303, 307]).toContain(response.status())
  expect(response.headers()['location']).toContain('/auth/login')
})
