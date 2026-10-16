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
(`'use client'`), Remix, and Vite. No CSS imports required.

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Components](#components)
- [Hooks](#hooks)
- [Types](#types)
- [Security](#security)
- [SSR and React Server Components](#ssr-and-react-server-components)
- [Links](#links)
- [License](#license)

## Install

```sh
pnpm add @strimz/sdk-react
# npm install @strimz/sdk-react
# yarn add @strimz/sdk-react
```

`react` and `react-dom` (`^18 || ^19`) are peer dependencies.
`@strimz/sdk` is a regular dependency and installs automatically.

## Quick start

```tsx
'use client'
import { StrimzProvider, StrimzPayButton } from '@strimz/sdk-react'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <StrimzProvider
      publishableKey={process.env.NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY!}
      checkoutOrigin="https://www.strimz.finance"
    >
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
descendants. It throws on first render if you pass a secret key.

| Prop             | Default                      | Notes                                       |
| ---------------- | ---------------------------- | ------------------------------------------- |
| `publishableKey` | required                     | `pk_test_…` or `pk_live_…`                  |
| `apiBaseUrl`     | `https://api.strimz.finance` | Override for staging                        |
| `checkoutOrigin` | `https://strimz.finance`     | Origin of the hosted checkout, with no path |

Set `checkoutOrigin="https://www.strimz.finance"`. Not yet: the default
`https://strimz.finance` redirects to `www`, so checkout results from
the popup or embed are dropped. Tracked in
[#291](https://github.com/StrimzLab/strimz/issues/291).

### `<StrimzPayButton />`

Drop-in checkout button for an existing session. It accepts every
standard `<button>` attribute as well as the props below.

| Prop                 | Default           | Notes                                                            |
| -------------------- | ----------------- | ---------------------------------------------------------------- |
| `sessionId`          | required          | Returned by `strimz.paymentSessions.create(...)` on your backend |
| `mode`               | `popup`           | `popup` or `redirect`                                            |
| `theme`              | `auto`            | `auto`, `light`, or `dark`. Has no visual effect today           |
| `size`               | `md`              | `sm`, `md`, or `lg`                                              |
| `label`              | `Pay with Strimz` | Override the button content                                      |
| `onSuccess(txHash?)` | none              | Fires on `strimz:checkout:success` postMessage                   |
| `onCancel()`         | none              | Fires on `strimz:checkout:cancel` or popup close                 |
| `onError(error)`     | none              | Typed `Error`; narrow with `instanceof StrimzCheckoutError`      |

The button opens the hosted checkout. The hosted page handles wallet
connection and signing. In `mode="redirect"` the page navigates away,
so no callbacks fire; use your `successUrl` and webhooks instead.

### `<StrimzCheckoutEmbed />`

Iframe-embedded checkout for merchants who want the flow inside their
page rather than in a popup.

```tsx
<StrimzCheckoutEmbed
  sessionId={session.id}
  className="rounded-xl border"
  onSuccess={(txHash) => router.push(`/thanks?tx=${txHash ?? ''}`)}
/>
```

| Prop                 | Default  | Notes                                       |
| -------------------- | -------- | ------------------------------------------- |
| `sessionId`          | required | The session to pay                          |
| `height`             | `600`    | Iframe height                               |
| `theme`              | system   | `light` or `dark`; omit to follow the payer |
| `onSuccess(txHash?)` | none     | Payment confirmed                           |
| `onCancel()`         | none     | Payer cancelled                             |
| `onError(error)`     | none     | Typed `Error`                               |
| `className`, `style` | none     | Applied to the iframe wrapper               |

The embed has no theme toggle of its own; your page decides.

## Hooks

- `useStrimzContext()`. Returns `{ client, checkoutOrigin }` from the provider. Throws outside a `<StrimzProvider />`.
- `useStrimzClient()`. Returns the provider's `StrimzBrowserClient`.
- `useStrimzSession(sessionId, { pollIntervalMs })`. Returns `{ session, loading, error, refresh }`. Polls every 3000 ms by default and stops once the session is `confirmed`, `failed`, `expired` or `cancelled`.
- `useStrimzCheckout({ mode, onSuccess, onCancel, onError })`. Returns `{ open, close, status }` for a custom button. `status` is `idle`, `open`, `success`, `cancelled` or `error`.

```tsx
import { useStrimzSession } from '@strimz/sdk-react'

function PaymentStatus({ sessionId }: { sessionId: string }) {
  const { session, error } = useStrimzSession(sessionId)
  if (error) return <ErrorBanner error={error} />
  if (!session) return <Spinner />
  return <p>Status: {session.status}</p>
}
```

## Types

`StrimzProviderProps`, `StrimzContextValue`, `UseStrimzSessionResult`,
`UseStrimzSessionOptions`, `UseStrimzCheckoutOptions`,
`UseStrimzCheckoutResult`, `CheckoutMode`, `StrimzPayButtonProps`,
`StrimzPayButtonTheme`, `StrimzPayButtonSize`,
`StrimzCheckoutEmbedProps` and `StrimzCheckoutTheme` are exported, as
is the `StrimzCheckoutError` class (`code`, `sessionId`, `message`).

## Security

- The checkout posts its result only to the page that opened it, using that page's exact origin, never `'*'`.
- A result is accepted only when it comes from `checkoutOrigin`, from this component's own iframe or popup, for the session it opened, and matches the shared message schema. Another page or frame cannot spoof a success event.
- `<StrimzProvider />` rejects secret keys (`sk_*`), so a misconfigured environment fails loudly.

## SSR and React Server Components

Every export is marked `'use client'`. Import from a Client Component
in Next.js App Router. Server Components should only ever see the
session id; never instantiate `StrimzBrowserClient` on the server.

## Links

- [Documentation](https://www.strimz.finance/docs)
- [SDK reference](https://www.strimz.finance/docs/sdks/react)
- [Repository](https://github.com/StrimzLab/strimz/tree/main/packages/sdk-react)
- [Changelog](./CHANGELOG.md)
- [Issues](https://github.com/StrimzLab/strimz/issues)

## License

[MIT](./LICENSE) © Strimz
