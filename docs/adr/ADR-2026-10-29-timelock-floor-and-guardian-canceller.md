# ADR: Timelock delay floor per network and a guardian that can cancel queued operations

- **Status:** Accepted 2026-10-29
- **Date:** 2026-10-29
- **Scope:**
  - The admin handoff library `script/utils/AdminHandoff.sol`, `HandoffAdmin.s.sol` and the `handed-off` phase of `Verify.s.sol`.
  - Their tests, the contracts README and the testnet redeploy runbook.
  - No deployed contract changes. The handoff runs once per network, at the #142 redeploy and at mainnet launch.

## Context

Issue #379, from the 2026-10-28 audit.

1. **No delay floor.**
   - `AdminHandoff.check` only rejects `minDelay == 0` (`AdminHandoff.sol:84`), so `TIMELOCK_MIN_DELAY=1` hands every slow power to a timelock that waits one second.
   - The runbook says 300 seconds on testnet and 172,800 (48 hours) on mainnet, but nothing enforces it. A typo on mainnet removes the delay that protects upgrades, dependency rotation, token-list changes and role grants.
2. **Only the Safe can cancel.**
   - The timelock is created with the Safe as its only proposer (`:66-69`), and OpenZeppelin's constructor makes every proposer a canceller.
   - If the Safe is compromised, its queued operations can't be stopped. The delay then only gives people time to watch the attack happen.
   - The guardian key already exists for this kind of emergency: it can pause, and nothing else.

The issue suggested putting the floor in shared config. The handoff is a Foundry script and can't read the TypeScript packages, and no app needs the floor, so it lives in the script, keyed by chain id.

## Decision

1. **Delay floor by chain id** in `AdminHandoff`:

   | Chain             | id      | Floor                  |
   | ----------------- | ------- | ---------------------- |
   | Arc mainnet       | 5042    | 48 hours (172,800 s)   |
   | Arc testnet       | 5042002 | 300 s                  |
   | Local anvil/forge | 31337   | 1 s (rehearsal, tests) |
   | Anything else     | —       | refused                |
   - `check` reverts with `AdminHandoff__DelayBelowFloor(minDelay, floor)` below the floor, and with `AdminHandoff__UnknownChain(chainId)` on any other chain.
   - The floor replaces the zero check, since every floor is at least 1, and `AdminHandoff__ZeroDelay` is removed.

2. **Guardian required on mainnet:** `check` reverts with `AdminHandoff__GuardianRequired()` on chain 5042 when no guardian is set. On testnet and locally the guardian stays optional.
3. **Guardian as canceller:**
   - When a guardian is set, it gets the timelock's `CANCELLER_ROLE` and nothing else on the timelock: not `PROPOSER_ROLE` and not admin.
   - OpenZeppelin only lets the timelock's admin grant roles, so the handoff:
     1. creates the timelock with the deployer as a temporary admin;
     2. grants the guardian `CANCELLER_ROLE`;
     3. renounces the deployer's `DEFAULT_ADMIN_ROLE` on the timelock.

     All three happen in the same broadcast. The timelock then administers itself, as it does today.

4. **Verify:** a new `AdminHandoff.verifyTimelock(timelock, h)`, called at the end of `run` and from `Verify.s.sol` (`handed-off`), checks that:
   - the delay is at or above the floor;
   - the Safe holds `PROPOSER_ROLE` and `CANCELLER_ROLE`;
   - execution is open (`EXECUTOR_ROLE` to `address(0)`);
   - the guardian holds only `CANCELLER_ROLE`, or nothing when there is no guardian;
   - the deployer holds no timelock role;
   - the timelock is its own admin.

   Any difference reverts with `AdminHandoff__TimelockRoleMismatch(role, account, expected)`.

5. **Docs:**
   - The README and the redeploy runbook state the floors, and that a guardian is required on mainnet.
   - They describe the guardian as "pause any contract, cancel any queued timelock operation".

## Diagram

```mermaid
sequenceDiagram
    participant Safe
    participant T as TimelockController
    participant G as Guardian
    Safe->>T: schedule(upgrade X)  [PROPOSER_ROLE]
    Note over T: waits ≥ 48h on mainnet
    G->>T: cancel(id)  [CANCELLER_ROLE]
    Note over T: operation dropped; G cannot schedule anything
```

## Consequences

- **Delay:** a mistyped or hostile `TIMELOCK_MIN_DELAY` can't shorten it below the network floor.
- **Compromised Safe:** its queued operations can be vetoed by a separate key that can't propose anything.
- **Compromised guardian:** it can pause contracts and cancel queued operations. Both are delays, never a loss of funds. The Safe can unpause and re-queue, and the timelock can revoke the guardian's role.
- **Mainnet:** the handoff can't run without a guardian key.
- **Cost:** two more transactions in the handoff broadcast, the grant and the renounce.

## Alternatives considered

- **Floor in shared config:** the Solidity script can't read it, and copying it into the script would leave two values to keep in step.
- **Guardian optional everywhere:** a mainnet handoff without one leaves the Safe as the only canceller.
- **Guardian as proposer too:** that would give a single key the power to queue upgrades.
- **Cancel by a second Safe:** that's stronger, but it's a second multisig to set up and run before launch. A single guardian key matches the pause model we already have.

## Verification

- **Red, on `main`:**
  - A handoff with a 1-second delay on chain 5042002 or 5042 succeeds, but should revert with `AdminHandoff__DelayBelowFloor`.
  - A handoff on an unknown chain succeeds.
  - A mainnet handoff without a guardian succeeds.
  - After a handoff the guardian can't `cancel` a Safe-queued operation (`AccessControlUnauthorizedAccount`).
- **Green:**
  - All of the above behave as described.
  - The guardian cancels a queued operation, and it can no longer be executed.
  - The guardian can't `schedule`.
  - The deployer holds no timelock role.
  - `verifyTimelock` rejects a timelock where the guardian is a proposer.
  - The existing handoff tests pass, with the test chain id set where needed.
- `./scripts/preflight.sh` passes in full.
