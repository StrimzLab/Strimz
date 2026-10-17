# ADR: Send the webhook events we list, drop the ones with no producer, retry failed trial charges

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17
- **Issue:** #295
- **Scope:**
  - `packages/shared-types`, `packages/shared-config`, `packages/sdk`: three event names and their
    envelope types removed. Breaking for anyone who typed against them (pre-1.0, so a minor bump).
  - `packages/db`: migration that removes three values from the `WebhookEventName` enum and strips
    them from existing endpoints.
  - `apps/api`: `payment.created` fired when a payment session is created.
  - `apps/agent`: `subscription.recovery_attempt` fired when a recovery email is sent.
  - `apps/scheduler`: outbox learns the `subscription.recovery_attempt` ref.
  - `apps/indexer`: a payment failure on a `trialing` subscription moves it to `at_risk`.
  - `apps/web`: endpoint picker follows the shared list (no code change), mock data and docs.

## Context

Checked against `main` at `39d2255`.

1. **Five subscribable events have no producer.** `webhookEventNameSchema`
   (`packages/shared-types/src/webhooks.ts`) lists them, the dashboard picker offers them
   (`apps/web/src/lib/webhook-events.ts` reads the schema), and nothing writes a `WebhookEvent` row
   for them:
   - `payment.created`
   - `subscription.recovery_attempt`
   - `subscription.recovery_outcome`
   - `refund.failed`
   - `agent.action_executed`
2. **`payment.created` has an obvious producer.** `PaymentSessionsService.insert` creates every
   session, both from `POST /v1/payment-sessions` and from a storefront buy (inside the storefront's
   stock transaction). The storefront case is the useful one: the payer starts it, so the merchant
   doesn't otherwise know a checkout began.
3. **`subscription.recovery_attempt` has one too.** `RecoveryService.tick` (`apps/agent`) sends the
   dunning email and logs `recovery_notification_sent` with `attemptNumber`. The payload is
   `{ subscription, attemptNumber }`. The agent has no subscription serialiser, but the outbox
   already builds payloads from a `{ ref }` for the indexer's events (`outbox-ref.ts`).
4. **`subscription.recovery_outcome` would repeat other events.** `recovered` is the next
   `subscription.charged` on an `at_risk` subscription, and `churned` is `subscription.lapsed`.
   Producing it means a second event from the indexer's charge projection and the lapsed cron for
   information the merchant already gets.
5. **`refund.failed` has nothing to observe.** Nothing ever sets a refund to `failed`. The merchant
   signs the refund transfer in their own wallet, and the API only learns of success through the
   indexer. A reverted or never-sent transfer leaves the refund `submitted` or
   `awaiting_signature`. Detecting that needs a receipt watcher, which is new work.
6. **`agent.action_executed` doesn't fit the webhook model.** Its payload is an `AgentActivityLog`
   row, which has no `mode`, while every event and endpoint is per mode. Digests and anomaly flags
   are merchant-wide. The dashboard's agent feed already shows every action.
7. **Endpoints store event names as a Postgres enum array.** `MerchantWebhookEndpoint.events` is
   `WebhookEventName[]`. `WebhookEvent.type` and `WebhookDelivery.eventName` use the same enum.
   The SDK parses endpoints with `webhookEndpointSchema` (`events` is a non-empty enum array), so an
   endpoint still holding a dropped name would fail to parse. There is no API to change an
   endpoint's events after creation, so an endpoint whose only events are dropped ones has never
   had a delivery.
8. **`invoice.sent`** is no longer in the docs (#154 removed it). Nothing to do.
9. **Trial charge failures.** On a payment failure the indexer sets `at_risk`, bumps `retryCount`
   and sets `nextRetryAt`, but only `WHERE status IN ('active','at_risk')`
   (`projections.go:766`). A first charge that fails at trial end leaves the subscription
   `trialing` with no `nextRetryAt`, so the sweeper retries it every 15 minutes, the lapsed cron
   (which only reads `at_risk`) never lapses it, and recovery never emails. The
   `subscription.charge_failed` event already fires; only the status update is skipped.

## Decision

1. **Emit `payment.created`** from `PaymentSessionsService.insert`, using the same database client
   as the insert, so a storefront buy that rolls back (sold out) doesn't announce a session. `data`
   is the serialised session. `WebhookEventService.fire` takes an optional transaction client.
2. **Emit `subscription.recovery_attempt`** from `RecoveryService` after a successful send. The
   agent writes an outbox row with `{ ref: { kind: 'subscription.recovery_attempt',
subscriptionId, attemptNumber } }` and the subscription's `mode`. The scheduler outbox adds that
   ref kind and builds `{ subscription, attemptNumber }`. A failed send or a skipped one (no email
   on file) fires nothing.
3. **Remove** `subscription.recovery_outcome`, `refund.failed` and `agent.action_executed`:
   - from `webhookEventNameSchema`, `WEBHOOK_EVENTS`, the envelope schemas, the
     `webhookEventSchema` union, and the SDK's exported event types;
   - from the Prisma `WebhookEventName` enum, with a migration that:
     1. removes the three names from every endpoint's `events`;
     2. deletes endpoints left with no events (none of them can have a delivery, see Context 7);
     3. recreates the enum without the three values.
   - They can come back with a producer later. `refund.failed` would come with a refund receipt
     watcher.
4. **Trial charge failures** go to `at_risk` like any other: the indexer's update matches
   `trialing` too. Retry backoff, the lapsed cron and recovery then apply unchanged.
5. **Docs:** drop the seven "Not yet … #295" notes. Add `payment.created` and
   `subscription.recovery_attempt` to the webhooks event table, remove the dropped events from the
   agents and refunds pages, and describe trial failures in the lifecycle and recovery pages.

```
POST /v1/payment-sessions ─┐
storefront buy (tx) ───────┴► PaymentSessionsService.insert ─► WebhookEvent payment.created (same tx)

agent RecoveryService ─► email sent ─► WebhookEvent { ref: recovery_attempt } ─► scheduler outbox
                                                                                 └► { subscription, attemptNumber }

indexer charge skip (payment failure) ─► status trialing|active|at_risk ─► at_risk + nextRetryAt
```

## Trade-offs

- **Removing instead of building.** Merchants lose three names they could pick but never received.
  Building `recovery_outcome` duplicates `charged`/`lapsed`; `refund.failed` needs a receipt
  watcher; `agent.action_executed` needs a mode model for merchant-wide actions. Each is better as
  its own issue if a merchant asks.
- **Deleting endpoints in the migration.** Only endpoints whose every event is a dropped one, so
  they've never received anything. The alternative, keeping an endpoint with an empty event list,
  breaks the non-empty rule the API and SDK enforce.
- **Breaking type change.** `SubscriptionRecoveryOutcomeEvent`, `RefundFailedEvent` and
  `AgentActionExecutedEvent` leave the SDK. No payload of those types was ever delivered, so no
  working handler depends on them.
- **`payment.created` for API-created sessions** tells the merchant something they just did. It
  costs one outbox row and matches what the name promises.
- **`agent.job_*` and `compliance.*`** also have no producer, but the docs already mark them as
  belonging to features that aren't live, and the picker hides `agent.job_*`. Out of scope.

## Tests (red first)

1. `apps/api/test/e2e`: creating a payment session writes a `payment.created` event whose payload
   parses with `paymentCreatedEventSchema`; a sold-out storefront buy writes none.
2. `apps/agent/test/e2e/recovery.e2e.test.ts`: a sent recovery email writes a
   `subscription.recovery_attempt` outbox row with the ref and the subscription's mode; a customer
   with no email writes none.
3. `apps/scheduler/test`: the outbox builds a valid `subscription.recovery_attempt` envelope from
   the ref.
4. `apps/indexer/internal/store/store_e2e_test.go`: a payment-failure skip on a `trialing`
   subscription leaves it `at_risk` with `retryCount` 1 and `nextRetryAt` set.
5. `packages/shared-types`: the three names no longer parse as event names; `webhookEventNameSchema`
   and the Prisma enum list the same names.
6. Migration: applied on a database holding an endpoint with
   `{payment_completed, refund_failed}` and one with `{agent_action_executed}`, the first keeps
   `{payment_completed}` and the second is gone.
