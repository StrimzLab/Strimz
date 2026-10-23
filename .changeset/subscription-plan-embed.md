---
'@strimz/shared-types': minor
'@strimz/sdk': minor
'@strimz/sdk-react': minor
---

Subscription plans get `successUrl` and `cancelUrl`, with `{SUBSCRIPTION_ID}` and `{ON_CHAIN_TX_HASH}` placeholders, and `subscriptionPlans.update` changes them. `@strimz/sdk-react` adds `useStrimzSubscribe`, `<StrimzSubscribeButton planId />` and `<StrimzSubscriptionEmbed planId />`, which report `onSuccess({ subscriptionId, txHash })`, `onCancel` and `onError(StrimzSubscriptionError)` from the hosted plan checkout. `@strimz/shared-types` adds `subscriptionResultMessageSchema` and `updateSubscriptionPlanInputSchema`.
