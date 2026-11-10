---
'@strimz/sdk': minor
'@strimz/shared-crypto': minor
---

Breaking: `SubscriptionIntentParams` gains two required fields, `permitValue` and `nonce`, and `SUBSCRIPTION_INTENT_TYPES` signs them, matching the redeployed `StrimzSubscriptions`. `@strimz/shared-crypto` adds `subscriptionIntentNonce(planId, payer, permitNonce)`, the nonce the Strimz relay accepts.
