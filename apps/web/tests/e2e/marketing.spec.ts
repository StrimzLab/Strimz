import { test, expect } from '@playwright/test'

test.describe('marketing', () => {
  test('landing page renders hero + CTAs', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /built on stablecoins/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /start building/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /read the docs/i })).toBeVisible()
  })

  test('pricing page lists all tiers', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByRole('heading', { name: /Pay only on what you process/i })).toBeVisible()
    for (const tier of ['Free', 'Starter', 'Growth', 'Enterprise']) {
      await expect(page.getByText(tier, { exact: true }).first()).toBeVisible()
    }
  })

  test('legal pages render', async ({ page }) => {
    for (const path of ['/legal/terms', '/legal/privacy', '/legal/acceptable-use']) {
      await page.goto(path)
      await expect(page.locator('h1')).toBeVisible()
    }
  })
})
