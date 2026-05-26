# @strimz/sdk

> The official Strimz Node SDK. Typed resources, automatic idempotency, retries, cursor pagination, EIP-712 typed-data builders, and webhook signature verification.

[![npm version](https://img.shields.io/npm/v/@strimz/sdk.svg?color=02C76A)](https://www.npmjs.com/package/@strimz/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@strimz/sdk.svg)](https://www.npmjs.com/package/@strimz/sdk)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@strimz/sdk.svg?label=size)](https://bundlephobia.com/package/@strimz/sdk)
[![types](https://img.shields.io/npm/types/@strimz/sdk.svg)](https://www.npmjs.com/package/@strimz/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-02C76A.svg)](./LICENSE)

The server-side client for the
[Strimz API](https://strimz.finance/docs/api/overview). Typed
resources for every endpoint, end-to-end TypeScript types derived
from the
[`@strimz/shared-types`](https://www.npmjs.com/package/@strimz/shared-types)
Zod schemas, and a webhook verifier you can drop into any handler.
Built for Node 22, Vercel Edge, and Cloudflare Workers from the same
code path.

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Resources](#resources)
- [Behaviour](#behaviour)
- [Webhook verification](#webhook-verification)
- [Browser client](#browser-client)
- [Error handling](#error-handling)
- [Runtime support](#runtime-support)
- [Links](#links)
- [License](#license)

## Install

```sh
pnpm add @strimz/sdk
# npm install @strimz/sdk
# yarn add @strimz/sdk
```

## Quick start

```ts
import { StrimzClient } from '@strimz/sdk'

const strimz = new StrimzClient({ apiKey: process.env.STRIMZ_SECRET_KEY! })

const session = await strimz.paymentSessions.create({
  amount: '1000000', // 1 USDC in smallest units
  currency: 'USDC',
  description: 'Premium plan, April',
  successUrl: 'https://app.example.com/success',
})

console.log(session.checkoutUrl)
```

Redirect the customer to `session.checkoutUrl`. They connect a wallet,
sign one EIP-3009 authorisation, and the Strimz relayer broadcasts
the on-chain transaction. Your webhook receives `payment.completed`
the moment it confirms.

## Resources

Every API resource is exposed as a property on the client. Method
signatures and response types come from
[`@strimz/shared-types`](https://www.npmjs.com/package/@strimz/shared-types).

| Resource            | Methods                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `merchants`         | `me`, `update`, `changeTier`                                                                                     |
| `apiKeys`           | `list`, `retrieve`, `create`, `revoke`                                                                           |
| `customers`         | `retrieve`, `list`, `upsert`                                                                                     |
| `paymentSessions`   | `create`, `retrieve`, `list`, `cancel`, `expire`                                                                 |
| `transactions`      | `retrieve`, `list`                                                                                               |
| `subscriptionPlans` | `create`, `retrieve`, `list`, `archive`                                                                          |
| `subscriptions`     | `create`, `retrieve`, `list`, `cancel`                                                                           |
| `refunds`           | `create`, `retrieve`, `list`, `submitSignature`                                                                  |
| `webhookEndpoints`  | `create`, `retrieve`, `list`, `enable`, `disable`, `rotateSecret`                                                |
| `webhookDeliveries` | `retrieve`, `list`, `replay`                                                                                     |
| `invoices`          | `create`, `retrieve`, `list`, `send`, `void`                                                                     |
| `storefronts`       | `retrieve`, `upsert`, `publish`, `archive`, `listProducts`, `createProduct`, `retrieveProduct`, `archiveProduct` |
| `agents`            | `retrieveConfig`, `updateConfig`, `listActivity`, `listJobs`, `retrieveJob`, `createJob`, `approveJob`           |

## Behaviour

- **Mode auto-detection.** Live versus test mode is derived from the API key prefix (`sk_test_` or `sk_live_`). The server client refuses publishable keys; use the [browser client](#browser-client) for those.
- **Automatic idempotency.** Every mutating call ships an idempotency key (`strimz_<uuid>`) so a network retry won't double-charge. Override with `{ idempotencyKey }` in the second argument if you want to dedupe across separate calls.
- **Retries.** Network errors, `5xx` responses on idempotent calls, and `429`s are retried up to 3 times with exponential backoff and jitter. `Retry-After` is respected on 429.
- **Pagination.** `list(...)` returns one page (`{ data, nextCursor, hasMore }`). `listAuto(...)` (where exposed) returns an async iterator you can `for await` over.
- **Typed errors.** The SDK throws on failure rather than returning `{ ok: false }`. Catch the base `StrimzError` or narrow with `instanceof` (see [Error handling](#error-handling)).

## Webhook verification

```ts
import { verifyWebhookSignature, parseWebhookEvent } from '@strimz/sdk/webhooks'

export async function POST(req: Request) {
  const body = await req.text()
  const result = await verifyWebhookSignature(
    body,
    req.headers.get('strimz-signature') ?? '',
    process.env.STRIMZ_WEBHOOK_SECRET!,
  )
  if (!result.valid) return new Response('invalid signature', { status: 400 })

  const event = parseWebhookEvent(body)
  switch (event.type) {
    case 'payment.completed':
      // event.data is typed as { session, transaction }
      break
    case 'subscription.charge_failed':
      // event.data is typed as { subscription, charge }
      break
  }
  return new Response('ok')
}
```

`verifyWebhookSignature` does a constant-time comparison and rejects
any timestamp older than 5 minutes by default. `parseWebhookEvent`
returns a discriminated union, so a `switch` over `event.type` is
exhaustively checked by TypeScript.

## Browser client

```ts
import { StrimzBrowserClient } from '@strimz/sdk/browser'

const strimz = new StrimzBrowserClient({
  publishableKey: process.env.NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY!,
})

const session = await strimz.paymentSessions.retrieve(sessionId)
```

The browser client exposes a strict subset of read-only resource
methods. It refuses secret keys at construction time so a
misconfigured environment fails loud.

For a full hosted-checkout UX with components and hooks, use
[`@strimz/sdk-react`](https://www.npmjs.com/package/@strimz/sdk-react).

## Error handling

Every error thrown by the SDK is a typed subclass of `StrimzError`:

```ts
import {
  StrimzError,
  StrimzAuthenticationError,
  StrimzValidationError,
  StrimzRateLimitError,
  StrimzNotFoundError,
} from '@strimz/sdk/errors'

try {
  await strimz.refunds.create({ ... })
} catch (err) {
  if (err instanceof StrimzValidationError) {
    console.error('validation failed on', err.param, ':', err.message)
  } else if (err instanceof StrimzRateLimitError) {
    await sleep(err.retryAfterMs)
    // … retry
  } else if (err instanceof StrimzError) {
    // unknown Strimz error
  } else {
    // not a Strimz error
  }
}
```

The full code list is documented at
[strimz.finance/docs/errors](https://strimz.finance/docs/errors).

## Runtime support

| Runtime            | Supported                                            |
| ------------------ | ---------------------------------------------------- |
| Node 22+           | Yes (primary)                                        |
| Vercel Edge        | Yes (uses Web Crypto + `fetch`)                      |
| Cloudflare Workers | Yes                                                  |
| Deno               | Should work, not regularly tested                    |
| Bun                | Should work, not regularly tested                    |
| Browsers           | Use `StrimzBrowserClient` from `@strimz/sdk/browser` |

## Links

- [Documentation](https://strimz.finance/docs)
- [API reference](https://strimz.finance/docs/api/overview)
- [Repository](https://github.com/StrimzLab/Strimz/tree/main/packages/sdk)
- [Changelog](./CHANGELOG.md)
- [Issues](https://github.com/StrimzLab/Strimz/issues)

## License

[MIT](./LICENSE) © Strimz
