---
date: 2026-10-29
feature: Escrow disputes keep the pre-dispute default; pause stops only new escrow
scope: fix
scenario-impact: none
---

# Agent escrow: fair unanswered disputes, and pause never traps funds

Two escrow findings from the 2026-10-28 audit.

1. An unanswered dispute could hand delivered work to the client for free.
2. A pause blocked every exit while the timeout clocks kept running.

Refs #376 and #377 (epic #387). ADR: [ADR-2026-10-29-escrow-dispute-and-pause](../adr/ADR-2026-10-29-escrow-dispute-and-pause.md).

The escrow is upgradeable, but it deploys fresh with #142 and stays paused for launch (#145). Nobody holds funds in it yet.

## What shipped

- **Disputes keep the pre-dispute default.** `dispute` records the status it leaves. After `DISPUTE_TIMEOUT` (30 days) with no resolution:
  - **Disputed from `Delivered`:** only the vendor can reclaim, and the vendor is paid. Anyone else gets `AgentEscrow__NotVendor`.
  - **Disputed from `InProgress`:** only the client can reclaim, and the client is refunded. This is unchanged.
  - `resolveDispute` can still split the amount at any time before a reclaim.
  - `JobReclaimed` keeps its signature. Its `to` can now be the vendor when `fromStatus` is `Disputed`.
- **New view:** `disputedFrom(uint256 jobId) returns (JobStatus)` (`0xc24ac5f9`). It returns `None` for a job that was never disputed.
- **Pause stops new escrow only.** `createJob` and `fundJob` still revert while paused. These now work while paused:
  - `startJob`, `submitDeliverable` and `approveAndRelease`;
  - `dispute`, `cancelJob` and `resolveDispute`;
  - `reclaimAfterTimeout`.
- **Storage:** one mapping appended to the ERC-7201 struct. No event changes.
- **Size:** 16,803 B runtime, a 7,773 B margin.

## For operators

- **Pausing for launch:** pausing the escrow (`testnet-redeploy.md`, step 4) still hides it, because nobody can create or fund a job.
- **Existing jobs:** a pause no longer stops them. If a bug is ever found in an exit path, the response is an upgrade through the timelock.

## Ships with #142

Nothing in the apps. The indexer reads the recipient from `JobReclaimed`, so a vendor reclaim from `Disputed` is recorded correctly without changes. #386 adds `disputedFrom` to the regenerated ABIs.

## Tests

- **New: `test/EscrowDisputeAndPause.t.sol`, 12 tests.**
  - On `main`, 8 of the first 11 fail for the reasons above: the client takes delivered work, the vendor is refused, and each lifecycle step reverts with `EnforcedPause`.
  - The other 3 already passed on `main`, and they still pass. They check that create and fund stay blocked while paused, and that the resolver can still split before the timeout.
  - The 12th test reads back `disputedFrom`.
- **New: `test/invariant/AgentEscrowInvariants.t.sol`.** It runs random creates, funds, starts, deliveries, approvals, disputes, resolutions, cancels, reclaims, time jumps and pause toggles: 256 runs and 128,000 calls, with 0 reverts. After every step it checks two things:
  - the escrow holds exactly the sum of its open jobs;
  - every open job can be reclaimed by the right party once its window passes.

  With `whenNotPaused` put back on `reclaimAfterTimeout`, the second invariant fails with `EnforcedPause`.

- **Updated comments:** the standing tables in the contract and in `StrimzAgentEscrow.t.sol` now describe the new dispute rule.
- `./scripts/preflight.sh` passes in full.
