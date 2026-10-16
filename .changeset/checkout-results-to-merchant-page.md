---
'@strimz/sdk-react': minor
'@strimz/shared-types': minor
---

The popup and the embedded checkout now report their result. `onSuccess`, `onCancel` and `onError` fire for the first time, because the hosted checkout posts to the page that opened it (that page's origin goes in a new `parent` query parameter).

- `@strimz/sdk-react`: a result is accepted only from the checkout origin, from the component's own popup or iframe, for the session it opened, and only if it matches the shared schema. `onError` receives a `StrimzCheckoutError` with `code` and `sessionId`. Closing the popup now fires `onCancel`, and `useStrimzSession` stops polling once the session is terminal. Earlier versions never receive a result.
- `@strimz/shared-types`: adds `checkoutResultMessageSchema` and `checkoutResultErrorCodes`. `createPaymentSessionInputSchema` now rejects a `successUrl` or `cancelUrl` that is not `http(s)`, as the session schema already did.
