import type { Locator, Page } from '@playwright/test'

/**
 * Page Object for `/about-us/`.
 * The hero heading is unique to this page. A missing page can keep the
 * `/about-us/` URL in `astro dev` and still render the 404, which also has an h1.
 */
export class AboutPage {
  readonly page: Page
  readonly heading: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', {
      level: 1,
      name: 'Our Journey'
    })
  }
}
