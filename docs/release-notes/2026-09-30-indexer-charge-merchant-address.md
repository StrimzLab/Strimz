---
date: 2026-09-30
feature: subscription.charged webhooks carry the merchant payout address
scope: fix
scenario-impact: none
---

# Subscription charge transactions record the merchant address

`subscription.charged` webhooks are delivered again. Before, every one of them failed
validation in the outbox dispatcher and was never sent.

Closes #116.

## What was wrong

The indexer wrote an empty `merchantAddress` on every subscription-charge transaction.
The shared webhook schema requires an EVM address there, so the dispatcher recorded a
`dispatchError` for each `subscription.charged` event and created no deliveries.

## What shipped

- The indexer joins the merchant's payout address into the charge projection and writes
  it on the transaction, the address the contract paid.
- A merchant with no payout address makes the projection fail loudly instead of writing
  an empty string.
- Scheduler tests now pin the contract from the consumer side: a charge transaction
  with a payout address dispatches, one with an empty address is rejected.

## Existing rows

Transactions written before this change still hold an empty address, and their events
still hold the dispatch error. To repair them:

```sql
UPDATE "Transaction" t
   SET "merchantAddress" = m."payoutAddress"
  FROM "Merchant" m
 WHERE t."merchantId" = m.id
   AND t.kind = 'subscription_charge'
   AND t."merchantAddress" = ''
   AND m."payoutAddress" IS NOT NULL;

UPDATE "WebhookEvent"
   SET "dispatchedAt" = NULL, "dispatchError" = NULL
 WHERE type = 'subscription_charged'
   AND "dispatchError" LIKE '%merchantAddress%';
```

The second statement makes the dispatcher pick those events up on its next tick and
deliver them. Merchants then receive the charge webhooks late, once each.
