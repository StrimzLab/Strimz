---
date: 2026-11-21
feature: Subscribers cancel from a hosted page; every cancel sends subscription.cancelled with who cancelled
scope: feat
scenario-impact: updated
---

# Subscribers can cancel, and merchants always hear about it

Closes #499 and #500. ADR: [ADR-2026-11-20-subscriber-self-cancel](../adr/ADR-2026-11-20-subscriber-self-cancel.md).

Needs the contracts from #504 (`cancelWithSig`). On the current testnet contracts, the cancel step of the page fails until the redeploy.

## For subscribers

- **New page: `checkout.strimz.finance/manage`.**
  - Connect the wallet, sign once (no gas) to see its open subscriptions, and cancel any of them with one more signature.
  - Strimz pays the network fee.
  - The page waits until the cancel is recorded, then says "Cancelled. You won't be charged again."
- **Emails:** the subscription started, subscription charged and allowance reminder emails link to `/manage?subscription=<id>`.

## For merchants

- **Every cancel now sends exactly one `subscription.cancelled`,** including one made from the hosted page or straight from the payer's wallet. Before this, a wallet cancel sent nothing.
- **New field `cancelledBy`** on subscriptions and on the webhook:
  - `payer`: the subscriber cancelled;
  - `merchant`: an API or dashboard cancel, or the merchant's owner wallet;
  - `strimz`: a Strimz operator key;
  - `null` until cancelled.
- **Packages:** `@strimz/shared-types` and `@strimz/sdk` get a minor version.

## Under the hood

- **Database:** migration `20261121120000_subscription_cancelled_by` adds the `SubscriptionCanceller` enum and the `Subscription.cancelledBy` column. It's additive.
- **API:**
  - `POST /v1/checkout/manage/subscriptions` lists a wallet's open subscriptions, after checking a signed `ViewSubscriptions` that is at most ten minutes old.
  - `POST /v1/checkout/manage/subscriptions/:id/cancel` checks the payer's `CancelSubscription` signature and relays `cancelWithSig`, under the new relay reason `cancelWithSig`.
  - Cancels don't count against the merchant's daily relay budget.
  - The merchant API cancel sets `cancelledBy = merchant`.
- **Indexer:** the cancel projection works out who cancelled from the event's `by` address, and writes the `subscription.cancelled` outbox event in the same transaction. A row the API already cancelled sends nothing more.
- **Scheduler:** the webhook outbox expands `subscription.cancelled`, and subscription payloads carry `cancelledBy`.

## Tests

- **Indexer:** the Go store e2e tests were red first: no canceller was recorded and no webhook was sent. They cover payer, merchant owner and Strimz cancels, and no second event after an API cancel.
- **Scheduler:**
  - an outbox e2e test, red first: a `subscription.cancelled` reference was dropped;
  - email link tests, red first.
- **API:**
  - the merchant cancel records `merchant` (red first);
  - relay unit tests for `cancelWithSig`: call data, idempotency, no budget spend, a stranger's signature, an expired deadline;
  - e2e tests for the two routes, with real signatures: the list only ever shows the signer's rows, a bad or expired sign-in is refused, a cancel is relayed, a stranger's cancel is refused, and an already-cancelled subscription is refused.
- **SDK and checkout:** a `ViewSubscriptions` builder test, plus page-state and API-call tests.
- **Full stack:**
  - the subscriber signs in and cancels through the new routes;
  - `cancelWithSig` lands;
  - the row reads `cancelled` with `cancelledBy = payer`;
  - the merchant gets one `subscription.cancelled` with `cancelledBy: payer`;
  - the subscriber's balance is unchanged, so no gas was paid;
  - after a 30-day warp, nothing is charged.

## Docs

- `subscriptions/cancellation` is rewritten: the hosted page, the `cancelledBy` values, and no more stale "on-chain cancel still reverts" line.
- `webhooks`, `api/subscriptions` and the self-serve cancel recipe no longer say that wallet cancels send no webhook.
