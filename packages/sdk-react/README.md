# @strimz/sdk-react

> React components and hooks for the Strimz hosted checkout. Drop-in `<StrimzPayButton/>`, embeddable iframe, typed hooks, and a context provider for the Strimz API.

[![npm version](https://img.shields.io/npm/v/@strimz/sdk-react.svg?color=02C76A)](https://www.npmjs.com/package/@strimz/sdk-react)
[![npm downloads](https://img.shields.io/npm/dm/@strimz/sdk-react.svg)](https://www.npmjs.com/package/@strimz/sdk-react)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@strimz/sdk-react.svg?label=size)](https://bundlephobia.com/package/@strimz/sdk-react)
[![types](https://img.shields.io/npm/types/@strimz/sdk-react.svg)](https://www.npmjs.com/package/@strimz/sdk-react)
[![React](https://img.shields.io/badge/React-18+%20|%2019-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-02C76A.svg)](./LICENSE)

A small surface of React building blocks for Strimz: a context
provider, a drop-in payment button, an embedded checkout, and a few
typed hooks. Works with React 18 or 19, Next.js App Router
(`'use client'`), Remix, and Vite. No Tailwind, no shadcn, no CSS
imports required.

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Components](#components)
- [Hooks](#hooks)
- [Security](#security)
- [SSR and React Server Components](#ssr-and-react-server-components)
- [Bundle](#bundle)
- [Links](#links)
- [License](#license)

## Install

```sh
pnpm add @strimz/sdk-react
# npm install @strimz/sdk-react
# yarn add @strimz/sdk-react
```

`@strimz/sdk` and `react@^18 || ^19` are peer dependencies.

## Quick start

```tsx
'use client'
import { StrimzProvider, StrimzPayButton } from '@strimz/sdk-react'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <StrimzProvider publishableKey={process.env.NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY!}>
      {children}
    </StrimzProvider>
  )
}

export function PayPage({ sessionId }: { sessionId: string }) {
  return (
    <StrimzPayButton
      sessionId={sessionId}
      onSuccess={(txHash) => console.log('paid:', txHash)}
      onCancel={() => console.log('cancelled')}
    />
  )
}
```

Your backend creates the session with
[`@strimz/sdk`](https://www.npmjs.com/package/@strimz/sdk) and
passes its `id` to the React component.

## Components

### `<StrimzProvider />`

Wraps any tree that uses Strimz components or hooks. Exposes a
memoised `StrimzBrowserClient` and the hosted-checkout origin to its
descendants.

| Prop             | Default                      | Notes                               |
| ---------------- | ---------------------------- | ----------------------------------- |
| `publishableKey` | required                     | `pk_test_…` or `pk_live_…`          |
| `apiBaseUrl`     | `https://api.strimz.finance` | Override for staging                |
| `checkoutOrigin` | `https://strimz.finance`     | Origin used to filter `postMessage` |

### `<StrimzPayButton />`

Drop-in checkout button for an existing session.

| Prop                 | Default           | Notes                                                            |
| -------------------- | ----------------- | ---------------------------------------------------------------- |
| `sessionId`          | required          | Returned by `strimz.paymentSessions.create(...)` on your backend |
| `mode`               | `popup`           | `popup` or `redirect`                                            |
| `theme`              | `auto`            | `auto`, `light`, or `dark`                                       |
| `size`               | `md`              | `sm`, `md`, or `lg`                                              |
| `label`              | `Pay with Strimz` | Override the button content                                      |
| `onSuccess(txHash?)` | none              | Fires on `strimz:checkout:success` postMessage                   |
| `onCancel()`         | none              | Fires on `strimz:checkout:cancel` or popup close                 |
| `onError(error)`     | none              | Fires on `strimz:checkout:error`                                 |

Internally the button uses Reown AppKit to connect a wallet, asks
the customer for a single EIP-3009 signature, and resolves once the
on-chain transaction confirms.

### `<StrimzCheckoutEmbed />`

Iframe-embedded checkout for merchants who want the flow inside their
page rather than in a popup.

```tsx
<StrimzCheckoutEmbed
  sessionId={session.id}
  className="rounded-xl border"
  onSuccess={(tx) => router.push(`/thanks?tx=${tx.txHash}`)}
/>
```

Renders the same UI as the hosted page, but inline. Useful for
cart-style flows where you don't want to lose the buyer's context.

## Hooks

- `useStrimzClient()`. Returns the singleton `StrimzBrowserClient`.
- `useStrimzSession(sessionId, { pollIntervalMs })`. Polls a session until it reaches a terminal state. Backed by TanStack Query.
- `useStrimzCheckout({ mode, onSuccess, onCancel, onError })`. Imperative checkout opener for custom UI.

```tsx
import { useStrimzSession } from '@strimz/sdk-react'

function PaymentStatus({ sessionId }: { sessionId: string }) {
  const { data, isLoading, error } = useStrimzSession(sessionId)
  if (isLoading) return <Spinner />
  if (error) return <ErrorBanner error={error} />
  return <p>Status: {data.status}</p>
}
```

Bring your own `QueryClient`, or wrap with `<QueryClientProvider>` if
you don't already have one.

## Security

- `postMessage` from the iframe or popup is filtered by `checkoutOrigin`. A page on a different origin cannot spoof a success event.
- `<StrimzProvider />` rejects secret keys (`sk_*`) at construction time, so a misconfigured environment fails loudly.

## SSR and React Server Components

Every export is marked `'use client'`. Import from a Client Component
in Next.js App Router. Server Components should only ever see the
session id; never instantiate `StrimzBrowserClient` on the server.

## Bundle

Distributed as ESM + CJS. React is `external`, so the published
bundle is small (around 6 KB gzipped before tree-shaking). Inline
styles in `<StrimzPayButton />` keep the dependency surface at zero.
No Tailwind, no shadcn, no CSS imports required.

## Links

- [Documentation](https://strimz.finance/docs)
- [SDK reference](https://strimz.finance/docs/sdks/react)
- [Repository](https://github.com/StrimzLab/Strimz/tree/main/packages/sdk-react)
- [Changelog](./CHANGELOG.md)
- [Issues](https://github.com/StrimzLab/Strimz/issues)

## License

[MIT](./LICENSE) © Strimz
