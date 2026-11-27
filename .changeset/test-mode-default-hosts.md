---
'@strimz/sdk': minor
'@strimz/sdk-react': minor
'@strimz/shared-config': minor
---

The default API host now follows the key. `sk_test_` and `pk_test_` keys go to `https://api-test.strimz.finance` (test mode on Arc testnet), and `sk_live_` and `pk_live_` keys go to `https://api.strimz.finance`. `StrimzProvider` also picks the hosted checkout from the key: `https://checkout-test.strimz.finance` for test keys, `https://checkout.strimz.finance` for live keys. An explicit `baseUrl`, `apiBaseUrl` or `checkoutOrigin` still wins.

`@strimz/shared-config` adds `markTestModeEmail` and `TEST_MODE_EMAIL_NOTE`, which label emails sent from the testnet deployment.
