---
'@strimz/shared-crypto': minor
---

Add `checkoutPaymentNonce(sessionId)` (also at `@strimz/shared-crypto/checkout`): the EIP-3009 nonce the hosted checkout signs for a payment session, `keccak256(abi.encode("strimz.checkout.payment-nonce.v1", sessionId))`. The Strimz relay refuses a payment authorization for a session that uses any other nonce. The package now depends on `viem`.
