import { test, expect } from '@playwright/test'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'

test.describe('Interledger Foundation Baseline E2E Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()
    await expect(page).toHaveTitle(/Interledger Foundation/)
  })

  test('homepage displays main hero heading', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()
    await expect(home.heroHeading).toBeVisible()
  })

  test('visitor can navigate from homepage to About Us', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()
    await home.navigateToAboutUs()
    await expect(page).toHaveURL(/\/about-us\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('nonexistent URL displays custom 404 page', async ({ page }) => {
    const notFound = new NotFoundPage(page)
    await notFound.gotoNonexistent()
    // Soft 404: body is 404.astro (often after redirect to /404); status may be 200.
    await expect(notFound.heading).toBeVisible()
    await expect(notFound.returnHomeLink).toBeVisible()
  })
})
