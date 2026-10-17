# ADR for Dummies: Every webhook a merchant can pick actually arrives

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17

## The Idea

Merchants choose which notifications ("webhooks") Strimz sends to their server. Five of the choices
on the list are never sent, because nothing in Strimz produces them. A merchant can tick the box
and wait forever.

Separately, when a free trial ends and the first payment fails, Strimz doesn't treat the
subscription as at risk. It keeps retrying every 15 minutes, never sends the reminder emails, and
never gives up.

## What Changes

1. **Two notifications start working:**
   - "payment created": sent when a checkout starts, including when a shopper starts one from a
     storefront.
   - "recovery attempt": sent each time Strimz emails a customer about a failed payment.
2. **Three are taken off the list:** "recovery outcome" (the merchant already hears "charged" or
   "lapsed"), "refund failed" (Strimz can't see a failed refund today) and "agent action" (already
   shown on the dashboard).
3. Endpoints that picked those three keep their other choices. An endpoint that picked only those
   three never received anything, and is removed.
4. A failed first payment after a trial is handled like any other failed payment: slower retries,
   reminder emails, and a lapse after the grace period.

## Important Limitation

- Developers who used the three removed names in their code will see a type error after updating
  the SDK. Those notifications were never sent, so nothing that worked breaks.

## What Does Not Change

Every notification that already arrives keeps the same name and contents. Payments and charges work
the same way.
