import type { Page } from '@playwright/test'

/**
 * `astro dev` can cover the page with a Vite error overlay or the dev toolbar.
 * Neither exists in a production response. Remove them so clicks hit the page.
 */
export async function dismissDevChrome(page: Page): Promise<void> {
  await page
    .locator('vite-error-overlay, astro-dev-toolbar')
    .evaluateAll((elements) => {
      for (const element of elements) element.remove()
    })
}
