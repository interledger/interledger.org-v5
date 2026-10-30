import type { Locator, Page } from '@playwright/test'

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
    this.heroHeading = page.locator('#home-hero-title')
    this.aboutUsLink = page.getByRole('link', { name: /about us/i })
  }

  async goto(): Promise<void> {
    await this.page.goto('/')
  }

  async navigateToAboutUs(): Promise<void> {
    await this.aboutUsLink.click()
  }
}
