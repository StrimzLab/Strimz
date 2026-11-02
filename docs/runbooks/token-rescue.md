# Runbook: return tokens sent to a contract by mistake

Use this when someone sends USDC or EURC straight to the Payments or Subscriptions address, outside a checkout. Neither contract keeps a balance between transactions, so anything either one holds arrived this way.

Each rescue raises a `tokens rescued` entry in the contract alert email.

1. Find the transfer to the contract address on Arcscan. Note the sender, the amount and the transaction hash.
2. Check that the contract's balance of that token covers the amount.
3. From the Safe, call `rescue(token, sender, amount)` on that contract. Put the transfer's transaction hash in the Safe transaction note.
4. When the alert email arrives, check that the token, recipient and amount match the transfer.

`rescue` works while the contract is paused. Only `ADMIN_ROLE` (the Safe and the timelock) can call it.
