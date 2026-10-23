---
date: 2026-10-23
feature: The indexer projects each merchant's registry fee and ceiling onto the Merchant row, and the scheduler emails ops when the chain fee differs from the plan fee
scope: feat
scenario-impact: none
---

# Merchant fee drift alerts

Fixes #226. ADR:
[ADR-2026-10-23-merchant-fee-drift](../adr/ADR-2026-10-23-merchant-fee-drift.md)
([plain-English version](../adr/ADR-2026-10-23-merchant-fee-drift-for-dummies.md)).

## What shipped

- **Migration `20261023120000_merchant_onchain_fee`.** It adds four nullable columns to `Merchant`: `onchainFeeBps`, `onchainMaxFeeBps`, `onchainFeeTxHash` and `onchainFeeChangedAt` (the block time of the last fee or ceiling event).
- **Indexer.**
  - **`MerchantRegistered`:** now decodes `maxFeeBps`, and the link update stores the registration fee and ceiling.
  - **`MerchantFeeBpsUpdated`:** stores the fee. **`MerchantMaxFeeBpsLowered`** (only the registry deployed before the fee-ceiling change emits it) stores the ceiling.
  - **Audit entries:** both events keep their existing audit entries.
  - **Unknown merchant:** an event for a merchant the indexer doesn't know logs a warning and moves on.
  - **Replays:** the projections write absolute values, so replaying a range changes nothing.
- **Scheduler: new `fee-drift` cron,** every 5 minutes (`FEE_DRIFT_CRON`).
  - **What it checks:** merchants whose chain fee differs from their plan fee (Free 0, Starter 50, Growth 40 bps), where the last chain change is more than 15 minutes old.
  - **What it skips:** Enterprise, and merchants without a projected fee.
  - **Both directions alert:** `below_plan` and `above_plan`.
  - **What it writes:** an `AuditLog` row (`merchant.fee_drift`) and a `ContractAlert` row. Both have a deterministic id, so one drift alerts once, and a new fee or plan change alerts again.
- **Contract-alert email.** It renders `merchant.fee_drift` as "Merchant fee differs from plan", with the merchant, plan and plan fee, chain fee, effect and a link to the transaction that set the chain fee.
- **Docs.** The self-hosting scheduler page lists `FEE_DRIFT_CRON` and the new job.

## Operators

- **Migration:** apply it with the API deploy (`prisma migrate deploy`).
- **Deploy order:** deploy the indexer and scheduler after the migration.
- **Existing merchants:** they have empty fee columns until their next fee event. The #142 testnet redeploy re-registers every merchant, which fills them. Empty rows are never checked.
- **Configuration:** nothing new is required. `FEE_DRIFT_CRON` is optional.
