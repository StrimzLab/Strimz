---
'@strimz/shared-types': minor
'@strimz/sdk': minor
---

Subscriptions say who cancelled them: `cancelledBy` is `'payer'`, `'merchant'`, `'strimz'` or `null`, and it is on every `subscription.cancelled` webhook. New `subscriptionCancellerSchema`. The SDK adds `buildViewSubscriptionsTypedData`, `VIEW_SUBSCRIPTIONS_TYPES` and `VIEW_SUBSCRIPTIONS_VALIDITY_SECONDS`, the gas-free sign-in a subscriber uses on Strimz's hosted cancel page.
