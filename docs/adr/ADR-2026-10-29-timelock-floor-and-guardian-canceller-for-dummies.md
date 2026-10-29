# ADR for Dummies: A delay we can't skip, and a second key that can say no

- **Status:** Accepted 2026-10-29
- **Date:** 2026-10-29

## The Idea

The big admin changes go through a "timelock". Examples are upgrading a contract, changing the token list and granting a role. The Strimz Safe queues the change, and it can only run after a waiting period, so anyone can see it coming.

The audit found two gaps:

1. **The waiting period could be set to one second by mistake.** Nothing checks it during setup.
2. **Only the Safe can cancel a queued change.** If someone took over the Safe, nobody could stop what they queued.

## The Fix

1. **A minimum wait per network.** Setup refuses to run unless the wait is at least 48 hours on mainnet and 5 minutes on testnet.
2. **The guardian can cancel.** The guardian is the emergency key that can already pause the contracts. It can now also cancel anything waiting in the timelock. It still can't queue anything itself.
3. **Mainnet needs a guardian.** Setup refuses to run on mainnet without one.

## What People See

- **Payers and merchants:** nothing.
- **Strimz:** if the Safe were ever compromised, the guardian could stop its queued changes before they run.

## Important Limitation

- **A stolen guardian key can only delay things.** It could pause the contracts or cancel queued changes, but it can't move money or change settings. The Safe can undo a pause and queue the change again.
- **This changes the setup script only.** It applies when setup runs at the testnet redeploy and at mainnet launch.

## What Does Not Change

- The contracts.
- What the Safe and the timelock can do.
- The guardian's pause power.
