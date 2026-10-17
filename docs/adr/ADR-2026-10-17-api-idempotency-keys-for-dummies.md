# ADR for Dummies: Sending the same request twice only does it once

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17

## The Idea

When a merchant's server asks Strimz to create something (a checkout, an invoice, a plan), the
internet sometimes drops the answer. Our SDK then asks again, which is the right thing to do. But
Strimz doesn't notice it's the same request, so it creates a second one. The merchant ends up with
two invoices, or two checkouts for one order.

Every request from the SDK already carries a unique label, called an idempotency key. Strimz will
now remember each label for 24 hours.

## What Changes

1. **Same label, same request:** Strimz sends back the first answer and does nothing new.
2. **Same label, different request:** Strimz refuses and says the label was already used.
3. **The first request is still running:** Strimz says "try again in a second", and the SDK waits
   and asks again.
4. Labels are kept separate per merchant, and test mode is separate from live.
5. The docs stop saying "not yet" and explain how it works.

## Important Limitation

- If a request fails on our side, asking again with the same label gives the same failure for 24
  hours. A new request gets a new label, which the SDK does on its own.
- Creating an API key or a webhook secret is left out on purpose. Remembering the answer would
  mean keeping a copy of the secret. A repeat there just makes a spare key you can delete.
- If our memory store (Redis) is down, write requests fail with an error instead of risking
  duplicates.

## What Does Not Change

Payments, charges and refunds on chain were already protected against running twice. The
dashboard, the database and the contracts don't change.
