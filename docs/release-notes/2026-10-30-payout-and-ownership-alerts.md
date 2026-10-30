---
date: 2026-10-30
feature: Merchants and admins are alerted when a payout or ownership change starts on chain
scope: feature
scenario-impact: needs_automation
---

# Alerts when a payout address or ownership change starts

A payout-address change or an ownership hand-over on the Registry waits 24 hours before it takes effect. Until now, nobody was told it had started. Now both the merchant and the Strimz team are alerted at once, so either can stop it in time.

Refs #380 (epic #387). ADR: [ADR-2026-10-30-payout-and-ownership-alerts](../adr/ADR-2026-10-30-payout-and-ownership-alerts.md).

This works with the deployed contracts and with the #142 ones; the events are the same.

## What shipped

- **Indexer:** `MerchantPayoutChangeInitiated` and `MerchantOwnershipTransferInitiated` now also:
  - write a pending `ContractAlert` row, so they join the admin alert email;
  - for a linked merchant, write a pending `MerchantSecurityAlert` row.

  Both inserts are idempotent on the audit row, so a replayed block doesn't alert twice. The ownership audit row gains `acceptableAt`, the block time plus 24 hours.

- **Database:** a new table `MerchantSecurityAlert`, with `id`, `auditLogId` (unique), `merchantId`, `createdAt` and `notifiedAt`. The migration is `20261030120000_merchant_security_alert`.
- **Scheduler, `merchant-notifications`:** a fifth lane emails the merchant with `MerchantSecurityAlertEmail` and stamps `notifiedAt`. A failed send stays pending and retries.
  - **Payout change** (subject "Your Strimz payout address is changing"): the new address, when it takes effect, and a button to Settings, where **Cancel pending** is.
  - **Ownership transfer** (subject "Your Strimz merchant account is being handed over"): the nominated wallet, when it can accept, and the support address.
- **Scheduler, `contract-alerts`:** two new entries in the admin email, "Merchant payout address change started" and "Merchant ownership transfer started". Each shows the on-chain merchant id, the address and the time.
- **Runbook:** `docs/runbooks/unexpected-admin-alert.md` covers how to confirm, stop, contain and write up an alert nobody expected.
- **Follow-up:** the dashboard can't cancel a pending ownership transfer yet. That's #397, and until it ships the ownership email points to support.

## For operators

- **Database:** run `prisma migrate deploy` before deploying the indexer and the scheduler. The indexer writes the new table, so the migration must be applied first.
- **Alert email:** no new env. Admin alerts go to `STRIMZ_ADMIN_ALERT_EMAIL` as before.

## Tests

- **Indexer e2e:**
  - `TestE2E_Stream_PayoutAndOwnershipChangesAlertTheAdminAndTheMerchant` failed on `main`: no admin alert, no merchant alert and no `acceptableAt`.
  - Now both initiations create one of each, a replay doesn't duplicate them, and a cancellation creates neither.
  - `TestE2E_Stream_PayoutChangeForAnUnlinkedMerchantAlertsOnlyTheAdmin` checks that an unlinked merchant raises only the admin alert.
- **Scheduler e2e, `merchant-security-alerts`:** 3 tests failed on `main` and pass now. They check that:
  - each kind is emailed once, with its address, time and link or support contact;
  - a failed send is retried.
- **Scheduler e2e, `contract-alerts`:** the new describe test failed on `main` and passes now.
- **Full suites:** the scheduler (129 unit, 72 e2e) and the indexer (unit and e2e) pass. `./scripts/preflight.sh` passes in full.
