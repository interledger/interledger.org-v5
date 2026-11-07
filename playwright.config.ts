import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:1103'

/**
 * Vite closes the dev server when stdin ends, unless `CI` is exactly `"true"`.
 * Playwright does not keep the webServer stdin open, so a backgrounded
 * `astro dev` exits. The flag applies only to that child process.
 */
function devServerEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  env.CI = 'true'
  return env
}

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
    // Bind IPv4 explicitly. On Windows, `astro dev` can listen on ::1 only,
    // and Playwright's readiness check then never reaches it.
    command: 'pnpm exec astro dev --host 127.0.0.1',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
    env: devServerEnv()
  }
})
