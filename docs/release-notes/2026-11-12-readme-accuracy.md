---
date: 2026-11-12
feature: The README says only what the product does today
scope: chore
scenario-impact: none
---

# README accuracy

The README now matches the code:

- The 30-second integration imports `StrimzClient`, the class `@strimz/sdk` exports.
  `Strimz` never existed, so the old sample did not compile.
- Checkout and subscription sign-up each ask the payer for two signatures, not one.
- Two processes hold signing keys, the api's relayer and the scheduler, each with narrow
  roles. Both refuse a plaintext key in production.
- Paying from other chains, the agent's `commerce` and `routing` jobs, and third-party
  wallet screening are marked as coming.
- The pause section names the three pausable contracts and says fee withdrawals are
  Safe-only rather than pausable.
- The escrow contract is listed as deployed but paused.

The scheduler's `SCHEDULER_PRIVATE_KEY` comment said the scheduler was the only process
with a key. It now says the software signer is for local and test use.

No behaviour changes.
