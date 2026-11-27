---
date: 2026-11-27
feature: Test mode asks for no passkey, SDKs pick the host from the key, test emails say so
scope: feat
scenario-impact: none
---

# Test mode: no passkey prompts, host from the key, labelled emails

Step 3 of [ADR-2026-11-26-test-mode](../adr/ADR-2026-11-26-test-mode.md) (#570).

## What changed

- **No passkey step-up on testnet.** The test backend no longer asks the dashboard for a passkey confirmation when a merchant:
  - creates or rotates an API key;
  - creates a webhook endpoint or rotates its secret.

  Test mode holds no real money. Mainnet asks every time, as before. The passkey step at sign-up doesn't change.

- **The SDKs pick their host from the key.**
  - `sk_test_` and `pk_test_` keys go to `https://api-test.strimz.finance`.
  - `sk_live_` and `pk_live_` keys go to `https://api.strimz.finance`.
  - `StrimzProvider` (`@strimz/sdk-react`) also defaults the hosted checkout to `https://checkout-test.strimz.finance` for test keys and `https://checkout.strimz.finance` for live keys.
  - An explicit `baseUrl`, `apiBaseUrl` or `checkoutOrigin` still wins.

  Going live is now a key swap. `@strimz/sdk`, `@strimz/sdk-react` and `@strimz/shared-config` get a minor release.

- **Test-mode emails say so.** Every email the test backend sends (API, scheduler and agent) has a subject starting with "[Test]" and a line at the top: "Sent from Strimz test mode on Arc testnet. No real money moved." Mainnet emails don't change.
- **Docs:** the SDK pages and READMEs describe the key-based defaults.

## Not changed

- The dashboard still asks for a passkey before a withdrawal or a refund. Those prompts run in the browser, and they go away for test mode with the Test / Live switch in step 4.
