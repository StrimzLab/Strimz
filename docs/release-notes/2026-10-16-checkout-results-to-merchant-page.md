---
date: 2026-10-16
feature: Hosted checkout reports paid, cancelled or failed to the merchant page that opened it
scope: fix
scenario-impact: none
---

# Checkout results reach the merchant page

Fixes #153. ADR: `docs/adr/ADR-2026-10-16-checkout-results-to-merchant-page.md` (and the for-dummies companion).

## What shipped

- **Popup and embed results.** `StrimzPayButton`, `useStrimzCheckout` and `StrimzCheckoutEmbed` (0.3.0) pass `?popup=1|embed=1&parent=<origin>`. The checkout posts `strimz:checkout:success | cancel | error` to `window.opener` or `window.parent` with that exact origin. With no valid `parent`, nothing is posted.
- **No navigation in popup or embed.** Success shows the completion panel without the countdown. In a popup, "You can safely close this window" appears after 2 seconds if the SDK hasn't closed it.
- **Cancel.** Full page: goes to `cancelUrl` with `{CHECKOUT_SESSION_ID}` filled in, or shows "Payment cancelled. Nothing was charged." It no longer sends the payer to the Strimz homepage. The same panel replaces the homepage redirect on `/sub/[planId]`. Cancel is hidden once the payer has signed, because the payment may already be moving. The session is not changed on the server.
- **Placeholders.** `{CHECKOUT_SESSION_ID}` and `{ON_CHAIN_TX_HASH}` are filled in, URL-encoded.
- **Callback URL validation.** The create-session input now rejects non-`http(s)` `successUrl`/`cancelUrl` with `400 invalid_request`. Before, only the response schema did, so a `javascript:` URL was stored and then broke that session's checkout.
- **Smart-contract wallets.** After connect, the checkout reads the payer's code on Arc. Contract accounts see "Smart-contract wallets (like Safe) can't pay here yet" before any signature, and the merchant page gets `unsupported_wallet`. EIP-7702 delegated accounts count as regular wallets. Pay stays disabled while the check runs.
- **SDK fixes.** Closing the popup fires `onCancel` once. `useStrimzSession` stops polling at a terminal state. Messages are accepted only from the SDK's own popup or iframe, for the session it opened, and only if they parse with the shared schema.
- **Docs.** `checkout/callbacks` no longer promises the `{AMOUNT}` placeholder, `422 invalid_callback_url`, a 2048-character cap, a dashboard warning, redirect logging, a server-side cancel or a link back to the business URL. `checkout/embed`, `sdks/react` and the SDK README document the callbacks and the 0.3.0 requirement.

## Operator steps

- Publish `@strimz/sdk-react` 0.3.0 and `@strimz/shared-types` with the changeset.
- Merchants on `@strimz/sdk-react` 0.2.x keep receiving no results until they upgrade.

## Verification

- **Red, then green:** on `a716e14`, all of these failed for the reasons named in the ADR:
  - shared-types `checkout-result-message.test.ts`: 11 of 13;
  - web `checkout-result.test.ts`, which failed to import because the module was missing;
  - web `checkout-result-wiring.test.ts`: 5 of 5;
  - sdk-react: 11 of 24 (no `parent`, cancel on close never firing, wrong source and session accepted, polling after `confirmed`).
- **API e2e** `payment-sessions.e2e.test.ts`: 18 of 18, including placeholders kept as written and a `javascript:` URL refused.
- `./scripts/preflight.sh` in full.
- **Manual testnet run** with `apps/demo-merchant` (popup and embed, pay and cancel): not yet done.
