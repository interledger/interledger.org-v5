import { test, expect } from '@playwright/test'
import { AboutPage } from '../pages/AboutPage'
import { HOME_DOCUMENT_TITLE, HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { NONEXISTENT_PATH } from '../utils/urls'

test.describe('Interledger Foundation Baseline E2E Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()
    await expect(page).toHaveURL('/')
    // Exact title. A regex would also match "Interledger Foundation | Page not found".
    await expect(page).toHaveTitle(HOME_DOCUMENT_TITLE)
    await expect(home.heroHeading).toBeVisible()
  })

  test('homepage displays main hero heading', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()
    await expect(home.heroHeading).toBeVisible()
  })

  test('visitor can navigate from homepage to About Us', async ({ page }) => {
    const home = new HomePage(page)
    const about = new AboutPage(page)
    await home.goto()
    await home.navigateToAboutUs()
    await expect(page).toHaveURL(/\/about-us\/$/)
    await expect(about.heading).toBeVisible()
  })

  test('nonexistent URL displays custom 404 page', async ({ page }) => {
    const notFound = new NotFoundPage(page)
    await notFound.gotoNonexistent()
    await expect(page).toHaveURL(new RegExp(`${NONEXISTENT_PATH}$`))
    await expect(notFound.heading).toBeVisible()
    await expect(notFound.returnHomeLink).toBeVisible()
  })
})
