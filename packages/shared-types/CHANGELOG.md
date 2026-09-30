# @strimz/shared-types

## 0.3.2

### Patch Changes

- bd6fc8d: Document enum values that first shipped in 0.3.1 without a changelog entry.

  `subscriptionChargeOutcomeSchema` accepts six more outcomes: `not_due`, `ended`, `duplicate`, `unknown`, `merchant_inactive` and `transfer_failed`. `agentJobStatusSchema` accepts three more statuses: `funded`, `resolved` and `reclaimed`.

  Code that switches over `SubscriptionChargeOutcome` or `AgentJobStatus` needs a branch for the new values. No code changes in this release.

## 0.3.1

### Patch Changes

- 6fed14f: Internal lint cleanup. `hashApiKey` and the notification schema behave exactly as before; no public types changed.

## 0.3.0

### Minor Changes

- 52c8b7b: Add a subscription-status check to the hosted checkout so a wallet can't enrol into the same plan twice. Adds `checkout.subscriptionStatus(planId, payer)` on the browser client and the `SubscriptionStatusResult` type, both backed by the public `GET /v1/checkout/plans/:id/subscription` endpoint.

## 0.2.0

### Minor Changes

- 832c104: Add EIP-712 typed-data intent builders (pay + subscription) to the SDK, with the supporting Zod schemas and inferred types.

## 0.1.1

### Patch Changes

- b1fbded: Standardise README layout and badges. Drop monorepo-internal references and external SDK comparisons from public-facing prose and source comments. No API or behaviour changes.
- Updated dependencies [b1fbded]
  - @strimz/shared-config@0.1.1
