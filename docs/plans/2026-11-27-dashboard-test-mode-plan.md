# Plan: dashboard Test / Live switch (test mode step 4)

ADR: [ADR-2026-11-26-test-mode](../adr/ADR-2026-11-26-test-mode.md), decisions 2 to 4.

## Today

- The dashboard is built for one network. `packages/web-shared/src/lib/env.ts` holds one API URL, one Arc environment, one RPC and one publishable key, all inlined at build time.
- About a dozen places read them directly: explorer links, withdraw, refunds, the on-chain policy panel, `providers.tsx`, `auth-sync.ts`, `lib/sdk.ts` and the uploadthing route.
- `getDashboardMode()` returns the build's mode, so it can't change at runtime.
- Checkout links (invoices, plans, storefront) use `siteUrls.checkout`.
- Data flows through one `MerchantApi` (`MerchantApiProvider`) and one React Query cache.
- Passkey prompts come from three places:
  - `useStepUp`, for API keys and webhooks;
  - `PasskeyGate`, on Withdraw and the payout-wallet settings;
  - the refund signer's enrolment check.
- Privy separately requires the passkey for every embedded-wallet signature, on any chain, with a 15-minute cache. The founder accepted that this one stays in test mode (2026-11-27).

## Design

### Networks

A `networks` module in `web-shared` describes up to two networks:

```ts
type Network = {
  mode: 'test' | 'live'
  arcEnvironment: 'testnet' | 'mainnet'
  apiUrl: string
  arcRpcUrl: string
  checkoutUrl: string
  publishableKey: string
}
```

- **Live** comes from today's variables.
- **Test** comes from new `NEXT_PUBLIC_TEST_*` build variables: API URL, checkout URL, RPC and publishable key.
- If the test variables are missing, the dashboard runs live only and shows no switch. That's a deliberate configuration, and it's logged once.
- A local dev build with `NEXT_PUBLIC_ARC_ENVIRONMENT=testnet` is test only, as now.

### Mode

- `DashboardModeProvider` holds the mode.
  - It's remembered per browser in `localStorage`, behind try/catch.
  - A browser with nothing saved starts in **Test** when Test is available.
- `useDashboardMode()` and `useNetwork()` read it.
- Switching mode:
  - clears the React Query cache;
  - points `MerchantApi`, `StrimzProvider` and the checkout links at the selected network.

  Test and live data never share a cache entry.

- Privy lists both Arc chains. `prepareArcSigning` already switches the wallet to the right chain before signing, so withdraw and refund use the selected network's chain.

### Top bar

- A **Test / Live** segmented switch, usable by keyboard and labelled for screen readers.
- In Test, a banner: "Test mode. Payments use testnet USDC from the faucet. Nothing here touches real money." It links to the docs page from #573.
- Light and dark themes, phone width.

### One sign-up, both accounts

- **Callback:** sync against live first, then test.
  - Sign-up saves **two** Turnstile tokens: the widget runs again silently after the first one. The test backend gets the second.
  - If the test sync needs a check anyway (428), the existing "One more step" widget handles it.
  - Routing still follows the live account.
- **Onboarding:** submit to live, then to test with the same details.
- **Filling in the missing side:** when the switch is on Test and the test account is missing or not onboarded, the dashboard:
  1. syncs it;
  2. onboards it with the business details from the live account (`GET /me` on live);
  3. shows "Setting up your test account".

  This also covers merchants who signed up before test mode, so they don't sign up again. A failure shows a retry, never a blank page.

- **Passkey enrolment sync** (`useEnrolPasskeyMfa`) syncs both.

### Passkey prompts in Test

- `useStepUp` returns no token in Test. The test backend skips step-up (#570).
- `PasskeyGate` renders its children in Test.
- The refund signer's enrolment check is skipped in Test.
- Privy's own signing prompt stays, as decided.

### Test checkout Worker

- The founder creates `strimz-checkout-test` (runbook section 6) once the Strimz test account can issue a `pk_test_` key.
- The dashboard's test network points its checkout links at `checkout-test.strimz.finance`.

## Delivery: two PRs, one issue

PRs 1 and 2 of the first draft ship together. Without the account flows, a new browser starts in Test and finds no test account, so the switch can't ship alone.

1. **Networks, the switch, the banner, the mode-aware API and cache, one sign-up for both accounts, and filling in the missing side.**
   - The gate and the sign-in pages always use the live account.
   - The live account keeps one cache; each visit to Test gets a fresh one.
   - `/v1/merchants/me` also returns `businessSector` and `phone`, so the dashboard can copy them.
2. **Passkey prompts off in Test**, then the test checkout Worker.

## Tests

- **Unit:**
  - network resolution: both, live only, test only, missing test variables;
  - the mode store: default Test, remembered choice, storage errors;
  - cache cleared on switch;
  - `useStepUp`, `PasskeyGate` and the refund check skip in Test only;
  - the callback and onboarding call both APIs in order;
  - the fill-in flow copies business details;
  - the sign-up token pair.
- **Browser:**
  - switch and banner in light and dark, desktop and phone;
  - every dashboard route in both modes, per the check-all-pages rule;
  - sign-up against local test and live APIs.
- **Live check after deploy:**
  - an existing mainnet account gets its test account;
  - a new sign-up appears in both databases;
  - a test key is created with no prompt;
  - a test withdrawal shows only Privy's prompt.

## Variables the founder sets on `strimz-dashboard` (build)

```
NEXT_PUBLIC_TEST_API_URL=https://api-test.strimz.finance
NEXT_PUBLIC_TEST_CHECKOUT_URL=https://checkout-test.strimz.finance
NEXT_PUBLIC_TEST_ARC_RPC_URL=https://rpc.testnet.arc.io
NEXT_PUBLIC_TEST_STRIMZ_PUBLISHABLE_KEY=pk_test_...   (after PR 2)
```

On the API side, test `CORS_ORIGIN` already includes `https://app.strimz.finance`.
