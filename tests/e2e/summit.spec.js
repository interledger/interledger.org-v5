import { test, expect } from '@playwright/test'

test('summit code of conduct renders', async ({ page }) => {
  await page.goto('/summit/code-of-conduct')
  await expect(
    page.getByRole('heading', { name: /code of conduct/i })
  ).toBeVisible()
})

test('home page renders', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Interledger/i)
})
