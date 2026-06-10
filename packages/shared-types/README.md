# @strimz/shared-types

> Zod schemas and inferred TypeScript types for every Strimz entity, API input, and webhook event.

[![npm version](https://img.shields.io/npm/v/@strimz/shared-types.svg?color=02C76A)](https://www.npmjs.com/package/@strimz/shared-types)
[![npm downloads](https://img.shields.io/npm/dm/@strimz/shared-types.svg)](https://www.npmjs.com/package/@strimz/shared-types)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@strimz/shared-types.svg?label=size)](https://bundlephobia.com/package/@strimz/shared-types)
[![types](https://img.shields.io/npm/types/@strimz/shared-types.svg)](https://www.npmjs.com/package/@strimz/shared-types)
[![License: MIT](https://img.shields.io/badge/License-MIT-02C76A.svg)](./LICENSE)

The Zod schema is the source of truth. TypeScript types are inferred
through `z.infer<>`, so the wire format and the compile-time shape
can never drift apart. The Strimz SDK consumes this package
internally, but you can use the schemas and types directly if you
prefer to validate the wire format in your own code.

## Install

```sh
pnpm add @strimz/shared-types
# npm install @strimz/shared-types
# yarn add @strimz/shared-types
```

## Quick start

```ts
import {
  createPaymentSessionInputSchema,
  type CreatePaymentSessionInput,
} from '@strimz/shared-types'

const parsed: CreatePaymentSessionInput = createPaymentSessionInputSchema.parse(req.body)
```

## Exhaustive webhook handling

```ts
import { webhookEventSchema, type StrimzWebhookEvent } from '@strimz/shared-types/events'

function handle(event: StrimzWebhookEvent) {
  switch (event.type) {
    case 'payment.completed':
      // event.data is typed as { session, transaction }
      break
    case 'subscription.charge_failed':
      // event.data is typed as { subscription, charge }
      break
    // TypeScript enforces exhaustiveness over the discriminated union.
  }
}
```

## Modules

Every group is also available as a subpath import for tree-shaking.

| Subpath             | Contains                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `/common`           | Primitives: ids, EVM address, tx hash, email, URL, money, pagination, metadata, mode, tier, environment |
| `/merchants`        | Merchant entity, login, member invites, tier changes                                                    |
| `/api-keys`         | Secret and publishable keys, scopes, rotation                                                           |
| `/customers`        | Payer identity                                                                                          |
| `/payment-sessions` | One-shot session entity, state machine, `createPaymentSessionInputSchema`                               |
| `/transactions`     | Confirmed on-chain payment records                                                                      |
| `/subscriptions`    | Plans, active subscriptions, per-period charges (with `chargeAttemptId`)                                |
| `/refunds`          | Merchant-initiated refund entity + signature flow                                                       |
| `/webhooks`         | Endpoints, deliveries, replay                                                                           |
| `/compliance`       | Sanctions screening log                                                                                 |
| `/agents`           | Identity, merchant config, activity log, ERC-8183 jobs                                                  |
| `/storefronts`      | Storefront + product                                                                                    |
| `/invoices`         | Invoice + line items                                                                                    |
| `/events`           | Discriminated `StrimzWebhookEvent` union covering every webhook payload shape                           |

The package root re-exports every subpath.

## Runtime support

Pure TypeScript with `zod` as the only runtime dependency. Works in
Node 22+, every modern browser, Vercel Edge, Cloudflare Workers,
Deno, and Bun.

## Design notes

- **Schemas describe wire format.** No business logic, no persistence, no side effects.
- **Amounts are decimal strings of the token's smallest unit** (USDC has 6 decimals, so `"1000000"` is 1 USDC). This preserves precision beyond `Number.MAX_SAFE_INTEGER`.
- **EVM addresses are normalised to lowercase on parse.** Transaction hashes are preserved verbatim.
- **Optional vs nullable is a real distinction.** Fields marked `.optional()` accept omission. Fields marked `.nullable()` accept explicit `null`. The two are not interchangeable on the wire.

## Links

- [Documentation](https://strimz.finance/docs)
- [Repository](https://github.com/StrimzLab/Strimz/tree/main/packages/shared-types)
- [Changelog](./CHANGELOG.md)
- [Issues](https://github.com/StrimzLab/Strimz/issues)

## License

[MIT](./LICENSE) © Strimz
