import { test, expect } from '@playwright/test'

test('theme toggle persists across navigation', async ({ page }) => {
  await page.goto('/')
  // Open the toggle dropdown.
  await page
    .getByRole('button', { name: /toggle theme/i })
    .first()
    .click()
  await page.getByRole('menuitem', { name: /dark/i }).click()

  // Wait for the class to land on <html>.
  await expect(page.locator('html')).toHaveClass(/dark/)

  // Navigate to pricing — theme should persist.
  await page.goto('/pricing')
  await expect(page.locator('html')).toHaveClass(/dark/)

  // Flip back to light.
  await page
    .getByRole('button', { name: /toggle theme/i })
    .first()
    .click()
  await page.getByRole('menuitem', { name: /^light$/i }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})
