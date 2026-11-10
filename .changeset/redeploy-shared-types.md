---
'@strimz/shared-types': minor
'@strimz/shared-config': minor
---

Add the `subscription.reactivated` webhook event, sent when Strimz restores a subscription its operator key cancelled, and the `token_not_allowed` subscription charge outcome, for a charge skipped because its token was removed from the whitelist. Hosted checkout no longer sends the `unsupported_wallet` checkout error, since smart-contract wallets can now pay; the code stays in `CheckoutResultErrorCode` so existing handlers still compile.
