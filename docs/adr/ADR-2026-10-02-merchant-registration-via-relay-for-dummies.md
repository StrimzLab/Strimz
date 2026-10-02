# ADR for Dummies: Register merchants on the blockchain in the background, exactly once

- **Status:** Accepted 2026-10-02
- **Date:** 2026-10-02

## The Idea

Before a merchant can be paid, Strimz records them on the blockchain. Today that happens
in the middle of the merchant's first request, which can hang for a minute, and if the
blockchain is slow it can record the same merchant twice. We move it to a background
worker that records each merchant once and never makes a request wait.

## What the Person Sees

1. A merchant finishes onboarding. Strimz starts recording them on the blockchain in
   the background straight away.
2. The merchant creates a checkout link a moment later. It is created instantly,
   instead of the dashboard spinning for up to a minute.
3. If a buyer opens that link in the first few seconds, the page says the merchant is
   still being set up, then switches to the pay button by itself. No reload.
4. If the blockchain is slow, the worker waits for its first attempt instead of trying
   a second time, so the merchant gets one blockchain identity, not two.

## Important Limitation

Merchants who were already recorded twice before this change keep the extra record on
the blockchain. It does no harm by itself, and an operator can switch it off by hand.
The release note explains how to find them.

## What Changes

- Recording a merchant on the blockchain happens in the background, starting at
  onboarding.
- Checkout links, subscription plans and invoices are created instantly.
- The checkout page refreshes itself while the merchant is being set up.
- The background worker that sends every Strimz blockchain transaction never sends the
  same job twice, which also stops one slow transaction from blocking all the others.
- One small database change to remember the blockchain transaction for each merchant.

## What Does Not Change

- The smart contracts, fees, payouts, webhooks and the SDK.
- Merchants who are already correctly recorded.
