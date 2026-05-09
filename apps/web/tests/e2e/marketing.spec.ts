import { expect, test } from '@playwright/test'

/**
 * Public marketing surfaces. These tests are intentionally lenient on
 * exact copy — the marketing prose evolves frequently. They assert
 * structural anchors (a heading rendered, the primary CTAs present,
 * tier names listed) rather than exact phrasings, so a copy edit
 * doesn't fail the suite.
 */
test.describe('marketing', () => {
  test('landing page renders hero + CTAs', async ({ page }) => {
    await page.goto('/')
    // The hero headline is split across multiple lines: "The billing
    // layer / for stablecoins." Asserting "stablecoins" is enough — it
    // sits in an h1 unique to the hero.
    await expect(page.getByRole('heading', { level: 1, name: /stablecoins/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /start building/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /read the docs/i }).first()).toBeVisible()
  })

  test('pricing page lists all tiers', async ({ page }) => {
    await page.goto('/pricing')
    await expect(
      page.getByRole('heading', { level: 1, name: /pay only for what you process/i }),
    ).toBeVisible()
    for (const tier of ['Free', 'Starter', 'Growth', 'Enterprise']) {
      await expect(page.getByText(tier, { exact: true }).first()).toBeVisible()
    }
  })

  test('legal pages render their h1', async ({ page }) => {
    for (const path of ['/legal/terms', '/legal/privacy', '/legal/acceptable-use']) {
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
    }
  })
})
