---
date: 2026-10-03
feature: Webhook verification and SDK examples in the docs match the real SDK
scope: fix
scenario-impact: none
---

# Docs: webhook verification examples that reject forged webhooks

The webhook examples in the developer docs now verify signatures correctly. The old
examples called `verifyWebhookSignature` without `await` and with the wrong arguments, so
a merchant who copied them accepted every webhook, signed or not. The quickstart install
step now renders as a code block, and every SDK example uses the classes and hooks the
packages actually export.

Closes #134.

## What was wrong

- `verifyWebhookSignature(payload, signatureHeader, secret, options?)` is async and
  resolves to `{ valid: true }` or `{ valid: false, reason }`. Five pages called it
  synchronously with one object argument and checked `if (!ok)`. The unawaited Promise is
  always truthy, so the check never rejected anything.
- Seven examples constructed `new Strimz(...)`. The server SDK exports `StrimzClient`.
- The React docs used hooks that do not exist (`usePaymentSession`, `useSubscription`,
  `useTransaction`, `usePayCheckout`, `useSubscriptionCheckout`), a `config` prop that
  `StrimzProvider` does not take, and an `onSuccess` argument of the wrong shape. The B2B
  recipe used `strimzWebhooks.constructEvent`, which does not exist.
- The quickstart install tabs put each fenced block on one line, so the page showed the
  literal text `bash pnpm add @strimz/sdk`.

## What shipped

- Every webhook receiver example `await`s `verifyWebhookSignature`, passes the raw body,
  the `strimz-signature` header and the secret in that order, and checks `result.valid`.
  Express examples read the raw body with `express.raw`.
- `StrimzClient` everywhere, with the real `timeoutMs` and `maxRetries` options, and
  server-side code marked as such. The docs say the secret key never goes in browser code.
- The React SDK page, embedded checkout page and Reown recipe describe the real surface:
  `StrimzProvider` with a publishable key, `StrimzPayButton`, `StrimzCheckoutEmbed`,
  `useStrimzSession`, `useStrimzCheckout` and `useStrimzClient`.
- The quickstart install tabs use multi-line fences.
- A Vitest check in `apps/web` reads every docs page and fails on an unawaited
  `verifyWebhookSignature(` in a code block, `new Strimz(`, a code fence sharing a line
  inside a `<Tab>`, or an import of a name that `@strimz/sdk`, `@strimz/sdk/browser`,
  `@strimz/sdk/webhooks` or `@strimz/sdk-react` does not export.

## Impact

Docs only. No API, SDK, contract or schema change. Merchants who copied an earlier
webhook example should update their receiver: the old code accepts unsigned requests.
