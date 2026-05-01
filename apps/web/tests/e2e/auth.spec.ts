import { test, expect } from '@playwright/test'

test.describe('auth surfaces', () => {
  test('signup page renders + reflects auth-not-configured state', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: /create your strimz account/i })).toBeVisible()
    await expect(page.getByText(/bot-protection.*disabled/i)).toBeVisible()
  })

  test('login page renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /log in to strimz/i })).toBeVisible()
  })
})
