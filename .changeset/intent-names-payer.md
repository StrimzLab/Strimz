---
'@strimz/sdk': minor
---

Breaking: `SubscriptionIntentParams` gains a required `payer`, and `SUBSCRIPTION_INTENT_TYPES` signs it first, matching the redeployed `StrimzSubscriptions` (audit L-08: one signature can no longer enrol a sibling smart wallet). New `buildCancelSubscriptionTypedData` and `CANCEL_SUBSCRIPTION_TYPES` build the `CancelSubscription` a payer signs so Strimz can cancel for them without gas (`cancelWithSig`). Update together with the contract switch; intents signed for the old contract are refused by the new one.
