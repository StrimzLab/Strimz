# ADR for Dummies: A checkout anyone can follow

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19

## The Idea

The payment page talks like a blockchain engineer. It says "signature", "settle", "on-chain" and "transaction", and when something breaks it can show a setup message meant for our developers. A customer who has never used stablecoins should only need to know three things: who they're paying, how much, and what to press.

## What the Payer Sees

1. **The order first:** "Pay Acme Studio", the item, and the amount in big type. One button: **Pay 25.00 USDC**, or **Subscribe for 10.00 USDC / month**.
2. **Everyday steps:** "Connect the wallet you'll pay from", then "Check your wallet and approve the payment", then "Processing your payment…".
3. **Helpful errors:** every problem says what happened, that nothing was charged, and what to do next. Setup details for our team stay hidden from the payer.
4. **A calm receipt** once the payment is truly done:
   - "Payment complete" with the amount, who was paid and the date;
   - a "View receipt on Arc explorer" link instead of a long code;
   - a way back to the shop.
5. **Fixes along the way:**
   - the storefront stops claiming payments take about 13 seconds, since Arc is under a second;
   - "every day" no longer prints as "every dai";
   - warnings look right in dark mode.

## Important Limitation

- **No way back to the shop after a subscription:** subscription plans don't store a "return to shop" address yet, so after subscribing the page says you can close the window.

## What Changes

- The wording and layout of the payment page, the subscription page and the storefront buy button.
- One shared receipt and one shared error message system.

## What Does Not Change

- How payments are approved, sent and confirmed. None of the money logic is touched.
