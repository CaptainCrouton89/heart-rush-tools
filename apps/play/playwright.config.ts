import { defineConfig } from '@playwright/test'

/**
 * End-to-end checks against the real host (plan ruling 19): Northlight accepts only the registered redirect URIs, so
 * these run on https://play.heartrush.party, not a local or preview build.
 *
 * The specs do not launch a browser. They attach over CDP to a browser that is already signed in to Heart Rush
 * (`PLAY_CDP`, default http://localhost:9222) and open their own tabs in it; see `e2e/fixtures.ts`. Each test closes
 * the tabs it opened and leaves the rest of the browser alone. Run one worker: the specs share one account's data.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: process.env.PLAY_E2E_OUT ?? 'test-results',
  use: {
    trace: 'off',
    screenshot: 'off',
  },
})
