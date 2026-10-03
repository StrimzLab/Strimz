# @strimz/shared-crypto

## 0.2.0

### Minor Changes

- 832149c: Add `checkoutPaymentNonce(sessionId)` (also at `@strimz/shared-crypto/checkout`): the EIP-3009 nonce the hosted checkout signs for a payment session, `keccak256(abi.encode("strimz.checkout.payment-nonce.v1", sessionId))`. The Strimz relay refuses a payment authorization for a session that uses any other nonce. The package now depends on `viem`.

## 0.1.2

### Patch Changes

- 6fed14f: Internal lint cleanup. `hashApiKey` and the notification schema behave exactly as before; no public types changed.

## 0.1.1

### Patch Changes

- b1fbded: Standardise README layout and badges. Drop monorepo-internal references and external SDK comparisons from public-facing prose and source comments. No API or behaviour changes.
- Updated dependencies [b1fbded]
  - @strimz/shared-config@0.1.1
