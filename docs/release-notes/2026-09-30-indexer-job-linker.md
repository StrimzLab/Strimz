---
date: 2026-09-30
feature: Escrow jobs are linked by their funding transaction
scope: fix
scenario-impact: needs_automation
---

# JobCreated links the job that Strimz funded

An on-chain `JobCreated` event now links the off-chain agent job whose funding
transaction it came from. Before, it linked any pending job for the same vendor.

Closes #119.

## What was wrong

The indexer matched `JobCreated` to an off-chain job by vendor address and a missing
on-chain id. `createJob` on the escrow is permissionless, so anyone could create a job
for a vendor and have it linked to a merchant's pending job. Two pending jobs for one
vendor were both updated with the same on-chain id, which violated the unique key and
stopped escrow indexing on that event.

## What shipped

- The scheduler already stores the funding transaction hash on the job before the
  event is indexed. The linker now matches on that hash and the vendor, and sets the
  on-chain id only on that row.
- A `JobCreated` that matches no funded job changes nothing and is logged with the
  client, vendor and transaction hash. The audit log entry is still written.

## Known gap

If the scheduler crashes after broadcasting the funding transaction and before it
stores the hash, the event arrives with no row to match and the job stays unlinked.
Reconciling those rows is not part of this change.
