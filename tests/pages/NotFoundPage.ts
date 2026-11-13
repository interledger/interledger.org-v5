import type { Locator, Page } from '@playwright/test'
import { NONEXISTENT_PATH } from '../utils/urls'

/**
 * Page Object for the custom 404 experience (`src/pages/404.astro`).
 *
 * In `astro dev`, a missing URL stays on the requested path and renders this
 * content (often HTTP 200). Netlify's `public/_redirects` is what forces a
 * real 404 status. Assert the heading, not the status code.
 */
export class NotFoundPage {
  readonly page: Page
  readonly heading: Locator
  readonly returnHomeLink: Locator

  constructor(page: Page) {
    this.page = page
    // Copy uses a unicode ellipsis (`…`), not three ASCII dots.
    this.heading = page.getByRole('heading', {
      level: 1,
      name: /page not found/i
    })
    this.returnHomeLink = page.getByRole('link', {
      name: /return to homepage/i
    })
  }

  async gotoNonexistent(path: string = NONEXISTENT_PATH): Promise<void> {
    await this.page.goto(path)
  }
}
