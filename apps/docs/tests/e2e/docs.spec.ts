import { test, expect } from '@playwright/test'

test('docs index renders', async ({ page }) => {
  await page.goto('/docs')
  await expect(page.getByRole('heading', { name: /welcome to strimz/i })).toBeVisible()
})

test('docs getting-started page renders', async ({ page }) => {
  await page.goto('/docs/getting-started')
  await expect(page.getByRole('heading', { name: /getting started/i })).toBeVisible()
})
