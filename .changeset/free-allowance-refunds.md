---
'@strimz/shared-config': minor
'@strimz/shared-types': minor
---

Free merchants now pay the Starter fee on chain from their first payment, and Strimz refunds it on each business's first 1,000 per currency (ADR-2026-11-21-free-plan-fee-integrity). `@strimz/shared-config` adds `onchainFeeBps(tier)`, the fee the Registry charges, and `FREE_ALLOWANCE_UNITS`. `@strimz/shared-types` adds `Transaction.feeRefund` (`amount`, `status`, `txHash`), `null` for payments outside the allowance.
