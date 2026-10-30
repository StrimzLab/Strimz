---
date: 2026-10-30
feature: Tests for subscription charge retries after a burned attempt id
scope: test
scenario-impact: none
---

# Tests for charge retries after a burned attempt id

The contract spends a charge's attempt id as soon as it tries the transfer. If the transfer then fails (`TransferFailed`, for example a blocklisted address), that id can't be used again. The scheduler handles this by deriving up to 8 attempt ids per period. Until now no test drove that path through the worker.

Refs #385 (epic #387). No behaviour change.

## What shipped

- **Chain stub:** a `chargeOutcomes` queue that applies each `batchCharge` the way the contract does:
  - a transfer that ran burns the id;
  - only a successful one ends the period;
  - a balance skip burns nothing.
- **Tests, in `subscription-due.e2e.test.ts`:**
  - after a `TransferFailed` the worker retries with the next id, and once charged the period isn't charged again;
  - the worker stops after the eighth burned id and releases the lock;
  - after a balance skip the retry reuses the same id.

## Tests

- The 3 new tests pass against the current worker. Since this is coverage for working code, each was checked by breaking the worker:
  - letting it try a 9th id fails the cap test, which the existing tests missed;
  - dropping the dueness check fails both charge-once tests;
  - picking the last unused id instead of the first fails the retry tests.
- `./scripts/preflight.sh` passes in full.
