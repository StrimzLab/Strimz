---
date: 2026-11-12
feature: Withdraw form clears after a send and explains an empty balance
scope: fix
scenario-impact: none
---

# Withdraw form

Withdrawing 2 EURC succeeded, but the amount field still said 2 afterwards. With the EURC balance now 0, the page then printed viem's whole error under the field: request body, calldata and version.

That error came from the network fee estimate, which simulates sending 1 unit of the selected token and re-runs every 15 seconds. With no balance the simulation reverts with "transfer amount exceeds balance".

- The amount clears once the transfer is signed.
- When the selected token's balance is 0, the page skips the fee estimate and says "You have no EURC to withdraw" (or USDC).
- A failed fee estimate shows one short sentence instead of the raw error.
- The settlement hint now says "Settles in under a second", matching Arc's finality. The balance refreshes 3 seconds after a send instead of 14.
