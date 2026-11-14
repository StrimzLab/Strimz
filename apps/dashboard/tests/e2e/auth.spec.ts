import { expect, test } from '@playwright/test'

/**
 * Auth surface smoke tests. These don't exercise the full Privy login
 * flow (that requires a real Privy app + a wallet) — only that the
 * pages mount and render their headings + primary CTA. The Privy
 * provider gracefully no-ops when `NEXT_PUBLIC_PRIVY_APP_ID` is
 * unset, so these pages render even in test environments without
 * auth configured.
 */
test.describe('auth surfaces', () => {
  test('signup page renders heading + continue CTA', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: /create your strimz account/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^continue$/i })).toBeVisible()
  })

  test('login page renders heading + continue CTA', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^continue$/i })).toBeVisible()
  })
})
