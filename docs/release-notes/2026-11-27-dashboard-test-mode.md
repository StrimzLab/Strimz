---
date: 2026-11-27
feature: Dashboard Test / Live switch, with one sign-up for both accounts
scope: feat
scenario-impact: none
---

# Dashboard Test / Live switch

Step 4 of [ADR-2026-11-26-test-mode](../adr/ADR-2026-11-26-test-mode.md) (#574), first part. Plan: [2026-11-27-dashboard-test-mode-plan](../plans/2026-11-27-dashboard-test-mode-plan.md).

## What merchants see

- **A Test / Live switch** in the top bar.
  - A new browser starts in Test, and the choice is remembered.
  - In Test, a banner says payments use testnet USDC and nothing touches real money.
- **Everything follows the switch:**
  - lists, details and actions;
  - checkout links for invoices, plans and the storefront;
  - explorer links;
  - the network the wallet signs on.

  Test and live data never share a cache.

- **One sign-up covers both.** Sign-in, onboarding, terms and the passkey step run on the live account as before. The first time a merchant opens Test, the dashboard creates their test account with the same business details and terms acceptance ("Setting up your test account"). Merchants who signed up before test mode get theirs the same way.
- **Turnstile:** the test backend needs its own Turnstile token, because tokens are single-use. Sign-up quietly gets a second one. If it has expired, the setup screen asks for the check.

## Under the hood

- **`web-shared/lib/networks`** describes the build's networks.
  - A mainnet build adds test mode when `NEXT_PUBLIC_TEST_API_URL` and `NEXT_PUBLIC_TEST_CHECKOUT_URL` are set. Without them, nothing changes and no switch shows.
  - `NEXT_PUBLIC_TEST_ARC_RPC_URL` and `NEXT_PUBLIC_TEST_STRIMZ_PUBLISHABLE_KEY` are optional.
- **`web-shared/lib/dashboard-mode`** holds the selected mode in a provider.
  - Admin has no provider yet, so it keeps the build's mode until step 5.
- **`GET /v1/merchants/me`** also returns `businessSector` and `phone`. `@strimz/shared-types` gets a minor release.
- **Runbook:** `docs/runbooks/cloudflare-workers.md` lists the new build variables.

## Still to come

- Strimz's own passkey prompts in Test (withdraw gate, refund check, API keys and webhooks in the dashboard): the next PR. The test backend already skips them on the server.
- The test checkout Worker.
- Admin's switch (step 5) and the docs (#573).
