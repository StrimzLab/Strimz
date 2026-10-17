---
date: 2026-10-17
feature: Every subscribable webhook event is sent; failed trial charges retry
scope: fix
scenario-impact: none
---

# Webhook events that arrive, and trial charge retries

Fixes #295. ADR: `docs/adr/ADR-2026-10-17-webhook-events-emitted.md` (and the for-dummies companion).

## What shipped

- **`payment.created`** fires when a payment session is created, from the API or a storefront buy. It is written in the same transaction as the session.
- **`subscription.recovery_attempt`** fires when the recovery agent emails a customer, with `{ subscription, attemptNumber }`. The agent writes an outbox ref and the scheduler builds the payload.
- **Removed:** `subscription.recovery_outcome`, `refund.failed` and `agent.action_executed`. Nothing ever sent them. They are gone from the shared types, the SDK, the dashboard picker and the `WebhookEventName` enum.
- **Trial charges:** a payment failure on a `trialing` subscription moves it to `at_risk` with the normal retry backoff, so it lapses after the grace window and gets recovery emails. Before, it stayed `trialing` and was retried on every sweep.
- **Docs:** the seven #295 notes are gone; the webhooks, payment sessions, agents, refunds, recovery and lifecycle pages describe what is sent.

## Operator steps

- Migration `20261017120000_drop_unsent_webhook_events` removes the three names from every endpoint's events and deletes endpoints left with none. Such an endpoint never received a delivery.
- Deploy the indexer, API, agent and scheduler together with the migration. The agent writes the new outbox ref, which the scheduler must know to dispatch.
