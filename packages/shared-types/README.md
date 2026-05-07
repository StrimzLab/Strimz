# @strimz/shared-types

Zod schemas and inferred TypeScript types for every entity, API input, and webhook event in the Strimz platform. The schema is the source of truth; types are inferred via `z.infer<>` so wire format and compile-time shape never diverge.

## Who uses what

| Consumer            | Why                                                                    |
| ------------------- | ---------------------------------------------------------------------- |
| `apps/api`          | Runtime validation of every request body, query string, and path param |
| `apps/scheduler`    | Validation of queued job payloads                                      |
| `apps/web`          | React Hook Form resolvers, typed API client responses                  |
| `@strimz/sdk`       | Typed request builders and typed response objects                      |
| `@strimz/sdk-react` | Typed props for `<StrimzPayButton />` and hooks                        |

## Module map

| Subpath             | Contains                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `/common`           | Primitives: ids, EVM address, tx hash, email, URL, money, pagination, metadata, mode, tier, environment |
| `/merchants`        | Merchant entity, login, member invites, tier changes                                                    |
| `/api-keys`         | Secret/publishable keys, scopes, rotation                                                               |
| `/customers`        | Payer identity                                                                                          |
| `/payment-sessions` | One-shot session entity + state machine + `createPaymentSessionInputSchema`                             |
| `/transactions`     | Confirmed on-chain payment records                                                                      |
| `/subscriptions`    | Plans, active subscriptions, per-period charges (with `chargeAttemptId`)                                |
| `/refunds`          | Merchant-initiated refund entity + signature flow                                                       |
| `/webhooks`         | Endpoints, deliveries, replay                                                                           |
| `/compliance`       | Sanctions screening log                                                                                 |
| `/agents`           | Identity, merchant config, activity log, ERC-8183 jobs                                                  |
| `/storefronts`      | Storefront + product                                                                                    |
| `/invoices`         | Invoice + line items                                                                                    |
| `/events`           | Discriminated `StrimzWebhookEvent` union — every webhook payload shape                                  |

The package root re-exports every subpath.

## Usage

```ts
import {
  createPaymentSessionInputSchema,
  type CreatePaymentSessionInput,
} from '@strimz/shared-types'

const parsed: CreatePaymentSessionInput = createPaymentSessionInputSchema.parse(req.body)
```

```ts
// In a webhook handler — exhaustive over every event kind
import { webhookEventSchema, type StrimzWebhookEvent } from '@strimz/shared-types/events'

function handle(event: StrimzWebhookEvent) {
  switch (event.type) {
    case 'payment.completed':
      // event.data is typed as { session, transaction }
      break
    case 'subscription.charge_failed':
      // event.data is typed as { subscription, charge }
      break
    // TypeScript enforces exhaustiveness
  }
}
```

## Boundaries

- Schemas describe wire format. They do not contain business logic, persistence, or side effects.
- Amounts are carried as decimal strings of the token's smallest unit (USDC has 6 decimals, so `"1000000"` is 1 USDC). This preserves precision beyond `Number.MAX_SAFE_INTEGER`.
- EVM addresses are normalised to lowercase on parse. Transaction hashes are preserved verbatim.
- Optional fields are marked `.optional()` (omission OK) and nullable fields are `.nullable()` (explicit `null` OK). These are different and not interchangeable.
