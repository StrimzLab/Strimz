# ADR (plain English): Merchants sign up with a 5% fee limit

- **Status:** Accepted 2026-11-20 by the founder
- **Date:** 2026-11-20

## What's the situation?

When a merchant signs up, the contract records the most Strimz can ever charge them. Today that limit is 0.5%, and it can never be raised. So even if network costs rise, Strimz could never charge more than 0.5%.

## What are we doing?

- **New merchants sign up with a 5% limit,** the most the contract allows.
- **Their actual fee doesn't change.** It's still the plan price: free to start, 0.5% on Starter, 0.4% on Growth.
- **Notice before increases:**
  - Moves between plans follow the published pricing.
  - Any other increase gets at least 30 days' notice by email.
- **The Settings page shows "Current fee" and "Most Strimz can charge".** It also stops claiming that merchants can lower the limit, because they can't.

## What does it change?

- **Room to raise prices later,** without changing the contract.
- **A bigger worst case if the scheduler's key leaks.** The key could schedule fee rises up to 5%, not 0.5%. A rise still waits 24 hours, and the admin can cancel it. Strimz already raises an alert when a rise is scheduled. Before mainnet, we need to make sure someone actually receives it.
- **Every merchant gets 5%.** The contract update starts a fresh merchant list, and everyone signs up on it again.
- **Timing:** this goes out with the contract update (PR #504), not before.
