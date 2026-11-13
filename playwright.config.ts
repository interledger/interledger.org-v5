import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:1103'

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
  reporter: [['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry'
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // `--ignore-lock` skips agent auto-background, so this process stays in the foreground.
    command: 'pnpm exec astro dev --host 127.0.0.1 --ignore-lock',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000
  }
})
