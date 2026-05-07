# @strimz/sdk

Server-side SDK for the Strimz API. Stripe-style — typed resources, idempotency, retries, pagination, and webhook signature verification.

## Installation

```sh
pnpm add @strimz/sdk
```

## Quick start

```ts
import { StrimzClient } from '@strimz/sdk'

const strimz = new StrimzClient({ apiKey: process.env.STRIMZ_SECRET_KEY! })

const session = await strimz.paymentSessions.create({
  amount: '1000000', // 1 USDC in smallest units
  currency: 'USDC',
  description: 'Premium plan – April',
  successUrl: 'https://app.example.com/success',
})

console.log(session.checkoutUrl)
```

## Modules

| Resource            | Path                                                                                                             |
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

- **Mode is auto-detected** from the API key prefix (`sk_test_` ↔ `sk_live_`). The client refuses publishable keys; use `StrimzBrowserClient` from `@strimz/sdk/browser` for those.
- **Idempotency** is automatic. Every mutating call generates an idempotency key (`strimz_<uuid>`) so a network retry doesn't double-charge a merchant. Override with `{ idempotencyKey }` in the second arg.
- **Retries**: network failures and 5xx (idempotent calls only) and 429 are retried up to 3 times with exponential backoff and jitter. `Retry-After` is respected on 429.
- **Pagination**: `list(...)` returns a single page; `listAuto(...)` (where exposed) returns an `AutoPagingIterator` that you can `for await` over.
- **Errors are typed**. The SDK never resolves to `{ ok: false }` — it throws. Catch `StrimzAuthenticationError`, `StrimzNotFoundError`, `StrimzValidationError`, `StrimzRateLimitError`, etc., or the base `StrimzError`.

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

## Browser

```ts
import { StrimzBrowserClient } from '@strimz/sdk/browser'

const strimz = new StrimzBrowserClient({
  publishableKey: process.env.NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY!,
})

const session = await strimz.paymentSessions.retrieve(sessionId)
```

The browser client exposes a strict subset of resource methods. It will refuse a secret key.

## Runtime support

| Runtime            | Supported                                            |
| ------------------ | ---------------------------------------------------- |
| Node 22+           | ✓ (primary)                                          |
| Vercel Edge        | ✓ (uses Web Crypto + fetch)                          |
| Cloudflare Workers | ✓                                                    |
| Deno / Bun         | should work; not regularly tested                    |
| Browsers           | use `StrimzBrowserClient` from `@strimz/sdk/browser` |

## Boundaries

- **No business logic** — the SDK validates inputs against `@strimz/shared-types` and forwards to the API.
- **No persistent state** — the client is safe to instantiate per-request or reuse across requests.
- **No secrets logged** — diagnostics never include the API key. Webhook signatures are verified with constant-time compare via `@strimz/shared-crypto`.
