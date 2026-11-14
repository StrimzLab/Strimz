# ADR for Dummies: A payment can never be refunded more than it was worth

- **Status:** Approved by the maintainer on 2026-11-13, with the recommended choices
- **Date:** 2026-11-13

## The Idea

A merchant can refund a payment in parts, but Strimz is supposed to stop them refunding
more than the payment in total. It checks by adding up the earlier refunds before
accepting a new one.

If several refund requests arrive at the same moment, for example from a double-click or
a merchant's system retrying, they all add up the earlier refunds before any of them is
saved. They all see "nothing refunded yet", and they all get accepted. In our test, seven
refunds of 60% each were accepted on one payment: 420% of it.

The fix: when a refund request arrives, Strimz briefly "holds" that one payment, so
requests for it are handled one after another. The second one then sees the first and is
refused.

## What the Person Sees

- **Merchants:** nothing changes for a normal refund. A duplicate or excessive one is
  refused with the usual "exceeds the remaining amount" message.
- **Customers:** nothing changes. Merchants always send refund money from their own wallet.

## Important Limitation

- Strimz never sent this money, since merchants send refunds themselves. The bug left
  wrong records and could lead a merchant's system to refund twice. The fix stops the
  records going wrong; it doesn't change any already created.

## What Changes

- How the API checks the refund limit.

## What Does Not Change

- The limit itself, every other answer the API gives, the database layout, the SDK and the
  contracts.

## Choices for the maintainer

- **C1.** Hold the one payment while checking, so requests for it wait their turn.
  Recommended.
- **C2.** If a request waits more than five seconds, answer with a new "refund in progress, try again" error, added to the docs. Recommended.
- **C3.** Leave refunds already over the limit as they are, and list them for review.
  Recommended.
