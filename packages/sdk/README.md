# @strimz/sdk

> The official Strimz Node SDK. Typed resources, automatic idempotency, retries, cursor pagination, EIP-712 typed-data builders, and webhook signature verification.

[![npm version](https://img.shields.io/npm/v/@strimz/sdk.svg?color=02C76A)](https://www.npmjs.com/package/@strimz/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@strimz/sdk.svg)](https://www.npmjs.com/package/@strimz/sdk)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@strimz/sdk.svg?label=size)](https://bundlephobia.com/package/@strimz/sdk)
[![types](https://img.shields.io/npm/types/@strimz/sdk.svg)](https://www.npmjs.com/package/@strimz/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-02C76A.svg)](./LICENSE)

The server-side client for the
[Strimz API](https://www.strimz.finance/docs/api/overview). Typed
resources for every endpoint, end-to-end TypeScript types derived
from the
[`@strimz/shared-types`](https://www.npmjs.com/package/@strimz/shared-types)
Zod schemas, and a webhook verifier you can drop into any handler.
Built for Node 22, Vercel Edge, and Cloudflare Workers from the same
code path.

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Options](#options)
- [Resources](#resources)
- [Behaviour](#behaviour)
- [Webhook verification](#webhook-verification)
- [Browser client](#browser-client)
- [EIP-712 builders](#eip-712-builders)
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

Redirect the customer to `session.checkoutUrl`. They connect a wallet
and approve two signature prompts (an EIP-3009 authorisation and the
Strimz `PayIntent`), and the Strimz relayer broadcasts the on-chain
transaction. Your webhook receives `payment.completed` the moment it
confirms.

## Options

| Option       | Default                      | Notes                                       |
| ------------ | ---------------------------- | ------------------------------------------- |
| `apiKey`     | required                     | `sk_test_…` or `sk_live_…`                  |
| `baseUrl`    | `https://api.strimz.finance` | Override the API host                       |
| `timeoutMs`  | `30000`                      | Per-request timeout                         |
| `maxRetries` | `3`                          | Retries for network errors, `5xx` and `429` |
| `onRequest`  | none                         | Callback before each request, for logging   |
| `onResponse` | none                         | Callback after each response, for logging   |
| `fetch`      | `globalThis.fetch`           | Inject a mock or polyfill                   |

`client.mode` is `'test'` or `'live'`, read from the key prefix.

## Resources

Every API resource is exposed as a property on the client. Method
signatures and response types come from
[`@strimz/shared-types`](https://www.npmjs.com/package/@strimz/shared-types).

| Resource            | Methods                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `merchants`         | `me`                                                                                                             |
| `apiKeys`           | `list`, `retrieve`, `create`, `revoke`                                                                           |
| `customers`         | `retrieve`, `list`, `upsert`                                                                                     |
| `paymentSessions`   | `create`, `retrieve`, `list`, `cancel`, `expire`                                                                 |
| `transactions`      | `retrieve`, `list`                                                                                               |
| `subscriptionPlans` | `create`, `retrieve`, `list`, `update`, `archive`                                                                |
| `subscriptions`     | `retrieve`, `list`, `cancel`                                                                                     |
| `refunds`           | `create`, `retrieve`, `list`, `submitSignature`                                                                  |
| `webhookEndpoints`  | `create`, `retrieve`, `list`, `enable`, `disable`, `rotateSecret`                                                |
| `webhookDeliveries` | `retrieve`, `list`, `replay`                                                                                     |
| `invoices`          | `create`, `retrieve`, `list`, `send`, `void`                                                                     |
| `storefronts`       | `retrieve`, `upsert`, `publish`, `archive`, `listProducts`, `createProduct`, `retrieveProduct`, `archiveProduct` |
| `agents`            | `retrieveConfig`, `updateConfig`, `listActivity`, `listJobs`, `retrieveJob`, `createJob`, `approveJob`           |

## Behaviour

- **Mode auto-detection.** Live versus test mode is derived from the API key prefix (`sk_test_` or `sk_live_`). The server client refuses publishable keys; use the [browser client](#browser-client) for those.
- **Idempotency keys.** Every `POST` and `PATCH` sends an `X-Strimz-Idempotency-Key` header (`strimz_<uuid>`). Pass `{ idempotencyKey }` in the options argument to set your own. `generateIdempotencyKey()` and `isValidIdempotencyKey()` are exported. The API replays the first response for a repeated key for 24 hours, so a retried call runs once.
- **Retries.** Network errors, `5xx` responses on idempotent calls, and `429`s are retried up to 3 times with exponential backoff and jitter. `Retry-After` is respected on 429.
- **Pagination.** `list(...)` returns one page (`{ data, nextCursor, hasMore }`). Pass `nextCursor` as `cursor` to get the next one.
- **Refunds.** `refunds.create` returns `{ refund, signingInstructions }`. Send the transfer in `signingInstructions` from the payout wallet, then call `refunds.submitSignature({ id, refundTxHash })`.
- **Version header.** Not yet: the `X-Strimz-Sdk-Version` header is always `0.0.0`. Tracked in [#296](https://github.com/StrimzLab/strimz/issues/296).
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
exhaustively checked by TypeScript. `signWebhookPayload` builds a
signature header for your own tests.

## Browser client

```ts
import { StrimzBrowserClient } from '@strimz/sdk/browser'

const strimz = new StrimzBrowserClient({
  publishableKey: process.env.NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY!,
})

const session = await strimz.checkout.session(sessionId)
```

The browser client has two resources, both on the public checkout and
token routes:

| Resource   | Methods                                                          |
| ---------- | ---------------------------------------------------------------- |
| `checkout` | `session`, `plan`, `merchant`, `subscriptionStatus`, `planTerms` |
| `tokens`   | `retrieve`, `permitNonce`                                        |

`selectPaymentPath` and `selectSubscriptionPath` map a token's
capabilities to the signing flow to use. The browser client refuses
secret keys at construction time so a misconfigured environment fails
loud.

For a full hosted-checkout UX with components and hooks, use
[`@strimz/sdk-react`](https://www.npmjs.com/package/@strimz/sdk-react).

## EIP-712 builders

`@strimz/sdk/eip712` builds the typed data a wallet signs:
`buildReceiveWithAuthorizationTypedData`, `buildPermitTypedData`,
`buildPayIntentTypedData` and `buildSubscriptionIntentTypedData`, with
their `*_TYPES` constants. Hosted checkout uses them; you only need
them if you build your own signing UI.

## Error handling

Every error thrown by the SDK is a typed subclass of `StrimzError`.
Each carries `code`, `httpStatus`, `requestId`, `param` and `details`.

| Class                       | When                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| `StrimzAuthenticationError` | `401`, or a secret key in a browser                              |
| `StrimzPermissionError`     | `403`                                                            |
| `StrimzNotFoundError`       | `404`                                                            |
| `StrimzIdempotencyError`    | `409` with code `idempotency_error` or `idempotency_in_progress` |
| `StrimzValidationError`     | `422`                                                            |
| `StrimzRateLimitError`      | `429`, with `retryAfterMs`                                       |
| `StrimzNetworkError`        | The request never got a response                                 |
| `StrimzTimeoutError`        | The request hit `timeoutMs`                                      |
| `StrimzModeMismatchError`   | Exported, but the client doesn't throw it today                  |

Any other status, including `400 invalid_request`, is a plain
`StrimzError`; check `err.code`. `classifyError(httpStatus, body)` maps
a status and error body to the right class.

```ts
import {
  StrimzError,
  StrimzAuthenticationError,
  StrimzRateLimitError,
  StrimzNotFoundError,
} from '@strimz/sdk/errors'

try {
  await strimz.paymentSessions.create({ ... })
} catch (err) {
  if (err instanceof StrimzError && err.code === 'invalid_request') {
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
[strimz.finance/docs/errors](https://www.strimz.finance/docs/errors).

## Runtime support

| Runtime            | Supported                                            |
| ------------------ | ---------------------------------------------------- |
| Node 22+           | Yes (primary)                                        |
| Vercel Edge        | Yes (uses Web Crypto + `fetch`)                      |
| Cloudflare Workers | Yes                                                  |
| Deno               | Should work, not regularly tested                    |
| Bun                | Should work, not regularly tested                    |
| Browsers           | Use `StrimzBrowserClient` from `@strimz/sdk/browser` |

`StrimzClient` refuses to start in a browser runtime: a page, a web worker, an Electron renderer, or React Native. It throws `StrimzAuthenticationError` with code `secret_key_in_browser` and a message that never contains the key. Node with a DOM shim such as jsdom, Deno, Bun, Vercel Edge and Cloudflare Workers count as servers. There is no option to turn the check off. Create payment sessions on your server and pass the session id to the browser; see [strimz.finance/docs/checkout/server-sessions](https://www.strimz.finance/docs/checkout/server-sessions).

## Links

- [Documentation](https://www.strimz.finance/docs)
- [API reference](https://www.strimz.finance/docs/api/overview)
- [Repository](https://github.com/StrimzLab/strimz/tree/main/packages/sdk)
- [Changelog](./CHANGELOG.md)
- [Issues](https://github.com/StrimzLab/strimz/issues)

## License

[MIT](./LICENSE) © Strimz
