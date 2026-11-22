---
date: 2026-11-22
feature: A slow refund is no longer marked failed
scope: fix
scenario-impact: updated
---

# A slow refund is no longer marked failed

Fixes #517. Follows [ADR-2026-11-13-refund-failures](../adr/ADR-2026-11-13-refund-failures.md).

## What was wrong

When a refund transfer had no receipt yet, the refund reconciler asked whether the sender's nonce had moved past the transfer. If it had, it marked the refund `failed` straight away ("transaction was replaced or dropped").

The receipt and nonce reads can reach different nodes. A node that is a block behind returns no receipt while a node that is up to date reports the nonce as used. A refund that had landed could then be marked failed. The merchant would see a failed refund and might refund the customer a second time.

## What changed

- **The receipt is read again.** When the nonce says the transfer can't be mined, the reconciler asks for the receipt once more and settles the refund from it if it is there.
- **A refund that looks dropped is not failed on the first check.** The reconciler records when it first looked dropped (`metadata.droppedSince`). It fails the refund only if it still looks dropped at least 60 seconds later. The reconciler runs every 15 seconds, so that is several further checks.
- **Unchanged:** reverted and mismatched transfers still fail at once, and a transaction no node has seen still waits, however old.

## Tests

`refund-reconciler.e2e` (scheduler):

- A receipt that only shows up after the nonce moves on completes the refund.
- The first check that looks dropped leaves the refund `submitted` and records `droppedSince`.
- A second check that is too soon still waits.
- The existing "fails once another transaction has used the nonce" test now fails the refund only after the 60-second window.

All 120 scheduler e2e tests pass.
