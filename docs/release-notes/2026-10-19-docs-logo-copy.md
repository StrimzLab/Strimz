---
date: 2026-10-19
feature: Docs logo follows the theme, and the docs drop processor comparisons
scope: fix
scenario-impact: none
---

# The docs logo is visible in dark mode

Closes #317.

## What shipped

- **Logo:** in dark mode the docs sidebar now shows the white Strimz logo instead of the navy one.
  - **Cause:** fumadocs-ui ships its own Tailwind v3 stylesheet outside any CSS layer. Its `img { display: block }` and `.hidden` rules beat our layered Tailwind v4 `dark:hidden` and `dark:block` utilities, so neither logo ever switched.
  - **Fix:** the two images get `docs-logo-light` and `docs-logo-dark` classes, and `docs.css` swaps them with plain rules.
- **Copy:**
  - **Welcome page:** no more three-day wait, chargeback window or reversing bank. It now says Arc finalises a block in under a second, so a payment is settled for good by the time the webhook fires.
  - **Hosted checkout:** the line crediting Stripe Checkout is gone.
  - **Withdraw:** "no chargeback" becomes "A sent withdrawal can't be reversed or cancelled."
- **Guard:** `docs-surface.test.ts` fails if any docs page mentions chargebacks, a three-day wait or Stripe, or if the logo goes back to Tailwind display utilities.

## Not changed

- The API, SDK, contracts and dashboard.

## Found while checking, logged separately

- #334: inline code in the docs shows literal backticks.
- #335: the docs sidebar lists "API Reference" twice.
