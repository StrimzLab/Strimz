---
date: 2026-10-29
feature: Admin handoff enforces a timelock delay floor per network and makes the guardian a timelock canceller
scope: fix
scenario-impact: none
---

# Admin handoff: a delay we can't skip, and a guardian that can cancel

The admin handoff now refuses a timelock delay below the network's floor. It also gives the guardian key the power to cancel operations queued in the timelock, so a compromised Safe's queued changes can be stopped.

Refs #379 (epic #387). ADR: [ADR-2026-10-29-timelock-floor-and-guardian-canceller](../adr/ADR-2026-10-29-timelock-floor-and-guardian-canceller.md).

Only the handoff script and the verify step change. No deployed contract changes. Everything here applies when the handoff runs at the #142 redeploy and at mainnet launch.

## What shipped

- **Delay floor:** the floor depends on the chain id.

  | Chain       | id      | Floor    |
  | ----------- | ------- | -------- |
  | Arc mainnet | 5042    | 48 hours |
  | Arc testnet | 5042002 | 300 s    |
  | Local       | 31337   | 1 s      |
  - Below the floor, the handoff reverts with `AdminHandoff__DelayBelowFloor(minDelay, floor)`.
  - Any other chain reverts with `AdminHandoff__UnknownChain(chainId)`.
  - `AdminHandoff__ZeroDelay` is removed, because the floor covers it.

- **Guardian:**
  - On mainnet the handoff reverts with `AdminHandoff__GuardianRequired()` when no guardian is set.
  - When a guardian is set, it gets the timelock's `CANCELLER_ROLE` and no other timelock role.
  - The timelock is created with the deployer as a temporary admin, the role is granted, and the deployer renounces the admin role in the same broadcast. The timelock then administers itself.
- **Verify:** `AdminHandoff.verifyTimelock` runs at the end of the handoff and in `Verify.s.sol` (`handed-off`). It reverts with `AdminHandoff__TimelockRoleMismatch(role, account, expected)` on any difference. It checks:
  - the delay floor;
  - that the Safe proposes and cancels;
  - that execution is open;
  - that the guardian only cancels;
  - that the deployer holds no timelock role;
  - that the timelock is its own admin.
- **Docs:** the contracts README (handoff section, role table, env table) and `docs/runbooks/testnet-redeploy.md` state the floors and the guardian's new power.

## For operators

- **Testnet:** set `TIMELOCK_MIN_DELAY=300` or more.
- **Mainnet:** set `TIMELOCK_MIN_DELAY=172800` or more, and `STRIMZ_GUARDIAN_ADDRESS` to a key that is neither the Safe, the relayer, the scheduler nor the deployer. Keep it offline.
- **To cancel a queued operation:** the guardian calls `cancel(id)` on the timelock. The id is in the `CallScheduled` event, or comes from `hashOperation` or `hashOperationBatch`.

## Tests

- **`AdminHandoff.t.sol`: 10 new tests.**
  - On `main`, 6 of them fail:
    - a testnet or mainnet delay below the floor is accepted;
    - an unknown chain is accepted;
    - a mainnet handoff without a guardian is accepted;
    - the guardian can't cancel;
    - the guardian has no timelock role.
  - The other 4 already passed on `main` or need the new verify helper:
    - the testnet and mainnet floors are accepted;
    - the guardian can't schedule;
    - `verifyTimelock` rejects a guardian that can propose.
- **Updated:** `test_refusesZeroDelay` now expects `AdminHandoff__DelayBelowFloor(0, 1)`.
- `./scripts/preflight.sh` passes in full.
