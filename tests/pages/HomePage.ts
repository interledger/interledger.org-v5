import type { Locator, Page } from '@playwright/test'
import { dismissDevChrome } from '../utils/dismissDevChrome'

/** Document title when the homepage title and the site name are the same. */
export const HOME_DOCUMENT_TITLE = 'Interledger Foundation'

/**
 * Page Object for the foundation homepage (`/`).
 * Keep selectors and visitor flows here so specs stay readable.
 */
export class HomePage {
  readonly page: Page
  readonly heroHeading: Locator
  readonly aboutUsLink: Locator

  constructor(page: Page) {
    this.page = page
    this.heroHeading = page.getByRole('heading', {
      level: 1,
      name: /rewriting the rules that move money/i
    })
    this.aboutUsLink = page.getByRole('link', { name: /about us/i })
  }

  async goto(): Promise<void> {
    await this.page.goto('/')
  }

  async navigateToAboutUs(): Promise<void> {
    await dismissDevChrome(this.page)
    await this.aboutUsLink.click()
  }
}
