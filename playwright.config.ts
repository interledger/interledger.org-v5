import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'http://localhost:1103'

/**
 * Playwright E2E config for the Astro site.
 * Specs: `tests/e2e/` · Page Objects: `tests/pages/` · Helpers: `tests/utils/`
 * See `tests/README.md`.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: 'e2e/**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry'
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'pnpm run start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  }
})
