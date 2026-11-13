---
date: 2026-11-13
feature: Refunds fail when their transaction can never land, a refund.failed webhook, and subscriptions.charges() in the SDK
scope: feature
scenario-impact: needs_automation
---

# Refund failures and SDK charge history

See `docs/adr/ADR-2026-11-13-refund-failures.md` and `docs/adr/ADR-2026-11-13-sdk-subscription-charges.md`.

## A refund that can never land now fails (#439)

- When a refund signature arrives, the API looks up the transaction and stores its sender and nonce in `Refund.metadata.refundTx`. The scheduler's `refund-reconciler` fills this in later if the API couldn't.
- With no receipt, the reconciler compares the sender's confirmed nonce with the transaction's. Once another transaction has used that nonce, the refund can never land. It becomes `failed` with "transaction was replaced or dropped", and its amount is freed.
- A transaction no node has ever seen stays `submitted`. Failing it on a timer could refund the payer twice if the signed transaction were broadcast later.

## `refund.failed` webhook (#440)

- New event `refund.failed`, with the refund and its `failureReason` as the payload. It fires once whenever a refund fails: reverted, wrong token, recipient or amount, or replaced or dropped.
- Prisma migration `20261113120000_refund_failed_webhook` adds `refund_failed` to `WebhookEventName`.
- Endpoints can subscribe to it, and the webhook and refund docs describe it.

## `subscriptions.charges()` in the SDK (#446)

`strimz.subscriptions.charges(id, { limit, cursor })` returns one page of `SubscriptionCharge` from `GET /v1/subscriptions/:id/charges`. The subscriptions API docs now document the route; they had said there were no charge routes.

The replaced-transaction path needs a real wallet to reproduce on testnet, so it's marked `needs_automation`.

The subscriptions API page also no longer says on-chain cancel reverts until the testnet redeploy, which has now happened.
