---
date: 2026-10-02
feature: Merchants register on chain once, in the background, and requests never wait for it
scope: fix
scenario-impact: needs_automation
---

# Merchant registration through the relay queue

Creating a checkout session, a subscription plan or an invoice no longer waits for the
blockchain. A merchant is registered on chain exactly once, in the background, starting
when they finish onboarding. The hosted checkout refreshes by itself while a brand-new
merchant is being set up.

Closes #123. ADR: [ADR-2026-10-02-merchant-registration-via-relay](../adr/ADR-2026-10-02-merchant-registration-via-relay.md)
([plain-English version](../adr/ADR-2026-10-02-merchant-registration-via-relay-for-dummies.md)).

## What was wrong

- Registration ran inside the request and waited up to 60 seconds for the receipt. A
  timeout saved nothing, so the next request registered again. The registry has no
  duplicate check, so each retry minted a new on-chain merchant id.
- Registration took nonces from the relay worker's counter without ever resyncing. A
  failed broadcast left a gap that stalled every later relay transaction.
- The relay worker signed a new transaction on every retry, even when the first one
  was still pending.
- The indexer linked `MerchantRegistered` by payout address, which is not unique.

## What shipped

- Migration `20261002120000_merchant_onchain_registration_tx`: `Merchant` gains
  `onchainRegistrationTxHash` (unique) and `onchainRegistrationRequestedAt`.
- Session, plan and invoice creation enqueue one `registerMerchant` relay job with job
  id `merchant-register:<merchantId>` and return at once with `chainMerchantId: null`.
  An ineligible merchant still gets 412. Onboarding starts registration when the
  merchant is already eligible.
- The relay job payload is a zod discriminated union in `@strimz/queue-contracts`, with
  the new `registerMerchant` arm. Producers parse before they add.
- The relay worker now records `{ txHash, nonce }` on the job before broadcasting. A
  retry confirms the recorded transaction, waits if it is still pending, re-signs with
  the same nonce if it was dropped, and only takes a new nonce when the old one was used
  by something else. This covers payments and subscriptions too.
- A reverted transaction is now a BullMQ `UnrecoverableError` and is not retried.
- The indexer links a registration by its transaction hash and warns when a
  `MerchantRegistered` matches no merchant.
- The pay and subscribe pages refetch every 3 seconds while the merchant has no on-chain
  id and switch to the pay button without a reload.

## SDK behaviour

A session or plan read straight after creation may carry `chainMerchantId: null` for a
few seconds for a merchant who has never been registered. This was already a valid value
of the field.

## Deploy

Run `prisma migrate deploy` before starting the new API and indexer.

## Finding merchants registered twice before this change

Orphan registrations are on-chain merchant ids that no `Merchant` row holds. After the
new indexer is running, they show up in its logs as
`MerchantRegistered matched no merchant` on a replay. They can also be listed by
comparing `MerchantRegistered` events from the registry against
`SELECT "onchainMerchantId" FROM "Merchant" WHERE "onchainMerchantId" IS NOT NULL`.
An admin can deactivate an orphan with the registry's `setActive(merchantId, false)`.
This is not done automatically.
