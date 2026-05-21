# @strimz/sdk-react

React components and hooks for Strimz hosted checkout. Drop-in `<StrimzPayButton/>`, embeddable iframe, typed hooks. Works with React 18 and 19, Next.js App Router (`'use client'`), Remix, and Vite.

## Install

```sh
pnpm add @strimz/sdk-react
```

(`@strimz/sdk` and `react` ≥18 are peer dependencies.)

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

The merchant's backend creates the session via `@strimz/sdk` and passes its `id` to the React component.

## API

### `<StrimzProvider/>`

Wraps any tree that uses Strimz components/hooks. Exposes a memoised `StrimzBrowserClient` and the hosted-checkout origin.

| Prop             | Default                      | Notes                               |
| ---------------- | ---------------------------- | ----------------------------------- |
| `publishableKey` | required                     | `pk_test_...` or `pk_live_...`      |
| `apiBaseUrl`     | `https://api.strimz.io`      | Override for staging                |
| `checkoutOrigin` | `https://checkout.strimz.io` | Origin used to filter `postMessage` |

### `<StrimzPayButton/>`

| Prop                 | Default           | Notes                                                            |
| -------------------- | ----------------- | ---------------------------------------------------------------- |
| `sessionId`          | required          | Returned by `strimz.paymentSessions.create(...)` on your backend |
| `mode`               | `popup`           | `popup` or `redirect`                                            |
| `theme`              | `auto`            | `auto` / `light` / `dark`                                        |
| `size`               | `md`              | `sm` / `md` / `lg`                                               |
| `onSuccess(txHash?)` | none              | Fired on `strimz:checkout:success` postMessage                   |
| `onCancel()`         | none              | Fired on `strimz:checkout:cancel` or popup close                 |
| `onError(error)`     | none              | Fired on `strimz:checkout:error`                                 |
| `label`              | `Pay with Strimz` | Override the button content                                      |

### `<StrimzCheckoutEmbed/>`

Iframe-embedded checkout for merchants who want the flow inside their page rather than in a popup.

### Hooks

- `useStrimzClient()`. Returns the singleton `StrimzBrowserClient`.
- `useStrimzSession(sessionId, { pollIntervalMs })`. Polls a session until it reaches a terminal state.
- `useStrimzCheckout({ mode, onSuccess, onCancel, onError })`. Imperative checkout opener for custom UI.

## Security

- `postMessage` from the iframe / popup is filtered by `checkoutOrigin`. A page on a different origin cannot spoof success.
- The provider rejects secret keys (`sk_*`) at construction time so a misconfigured environment fails loud.

## SSR / RSC

Every export is marked `'use client'`. Import these from a Client Component in Next.js App Router. Server Components should only ever see the session id; never instantiate `StrimzBrowserClient` on the server.

## Bundle

Distributed as ESM + CJS. React is `external`, so the published bundle is small (~6kb gzipped before tree-shaking). All inline styles in `<StrimzPayButton/>` keep the dependency surface zero. No Tailwind, no shadcn, no CSS imports required.
