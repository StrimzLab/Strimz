---
date: 2026-10-19
feature: Hosted checkout and storefront in plain language, with one receipt and one payer error mapper
scope: feat
scenario-impact: needs_automation
---

# A checkout anyone can follow

Closes #285. Part of #286.

- **ADR:** `docs/adr/ADR-2026-10-19-checkout-plain-language.md` and its for-dummies companion.
- **Audit:** posted on #285 before any change.

## What shipped

- **`/pay` leads with the order:**
  - the heading is "Pay {merchant}";
  - the button is "Pay 25.00 USDC";
  - the summary has one Total line.
- **`/sub` leads with the order:**
  - the heading is "Subscribe to {plan}";
  - the button is "Subscribe for 10.00 USDC / month", or the trial label.
- **Plain steps:**
  - "Approve" then "Processing", in place of "Sign" then "Settle";
  - "Connect the wallet you'll pay from";
  - "Check your wallet and approve the payment";
  - "How it works" no longer mentions signatures, transactions or "on-chain";
  - a small note says the payment is in USDC on the Arc network.
- **One payer error mapper** (`lib/payer-errors.ts`) for load, wallet, relay, storefront and email-attach errors:
  - **Wallet cancel:** "You cancelled in your wallet. Nothing was charged."
  - **Failures after the payment was sent:** "Don't pay again", with no "nothing was charged" promise.
  - **Setup faults:** "This checkout isn't available right now". The raw reason goes to the console and to the merchant-page message, unchanged.
- **One receipt panel** (`components/checkout/receipt-panel.tsx`) for both flows:
  - amount, merchant, item or plan, and date;
  - "View receipt on Arc explorer", with no raw hash;
  - the return link on `/pay`;
  - a one-time check draw, skipped under reduced motion;
  - shown only on a confirmed result.
- **Storefront:**
  - "Pay" and "Subscribe for" buttons;
  - sold-out and missing-product messages;
  - the false "Settles in ~13s on Arc" line is removed (Arc finalises in under a second);
  - the OG text drops "gas-free".
- **Fixes:**
  - "Charged every day" no longer reads "every dai";
  - the subscription cancel panel says "Subscription cancelled";
  - dark-mode colours for every red and amber notice and the sold-out overlay;
  - no monospace hashes or prices.

## Not changed

- Signing, relay, polling and the payment hooks.
- The API, schema, webhooks and published packages.

## Known gap

- `/sub` has no return-to-merchant link and no cancel destination, because plans have no `successUrl` or `cancelUrl`. Tracked with #153.

## Operator steps

None. Web only; it deploys with the next Vercel build.
