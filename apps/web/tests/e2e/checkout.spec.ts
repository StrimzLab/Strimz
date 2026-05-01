import { test, expect } from '@playwright/test'

test('checkout pay page renders for an arbitrary session id', async ({ page }) => {
  await page.goto('/pay/sess_test_abc')
  await expect(page.getByRole('heading', { name: /pay with usdc/i })).toBeVisible()
  await expect(page.getByText('sess_test_abc')).toBeVisible()
})

test('subscribe page renders for an arbitrary plan id', async ({ page }) => {
  await page.goto('/sub/plan_pro_monthly')
  await expect(page.getByRole('heading', { name: /^subscribe$/i })).toBeVisible()
})

test('public storefront renders for any slug', async ({ page }) => {
  await page.goto('/store/acme')
  await expect(page.getByRole('heading', { name: /welcome to acme/i })).toBeVisible()
})
