import type { Locator, Page } from '@playwright/test'
import { NONEXISTENT_PATH } from '../utils/urls'

/**
 * Page Object for the custom 404 experience (`src/pages/404.astro`).
 *
 * Locally (`astro dev` / `astro preview`), missing CMS routes often soft-404:
 * content redirects to `/404` (HTTP 200) rather than Netlify's forced `404!`
 * status from `public/_redirects`. Assert on visible copy, not status code.
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
