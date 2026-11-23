# Runbook: the Safe console

The Safe page in the admin app (`/admin/safe`) is how the Safe owners run admin actions on the Strimz contracts. It is for super admins only. See ADR-2026-11-23-safe-console.

Mainnet addresses aren't in this repo. They're in the ops manual.

## What it can do

| Action                                                                                                                                      | Waits 48 hours?           |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Pause or unpause Payments or Subscriptions                                                                                                  | No                        |
| Withdraw fees from the FeeCollector                                                                                                         | No                        |
| Grant or revoke `MERCHANT_REGISTRAR_ROLE` or `FEE_MANAGER_ROLE` (Registry), `CHARGER_ROLE` or `SUBSCRIPTION_CANCELLER_ROLE` (Subscriptions) | No                        |
| Grant or revoke any other role                                                                                                              | Yes, through the Timelock |
| Add, remove or replace a Safe owner; change the approvals needed                                                                            | No                        |
| Cancel a scheduled Timelock change                                                                                                          | No                        |

Contract upgrades aren't in the console. Use the command line below with the Timelock.

## Setup, once per environment

1. **Settings.** In the server `.env`:

   ```bash
   STRIMZ_SAFE_ADDRESS=0x...       # the 2-of-3 Safe
   TIMELOCK_ADDRESS=0x...          # from the handoff
   STRIMZ_GUARDIAN_ADDRESS=0x...   # owner A
   STRIMZ_FEE_COLLECTOR_ADDRESS=0x...
   STRIMZ_TOKEN_WHITELIST_ADDRESS=0x...
   ```

   The page says the console isn't configured until every one is set.

2. **Database.** The `20261123150000_safe_console` migration adds the `SafeProposal` tables. Apply it before the API starts.
3. **Relayer rule.** The relayer may only send Safe transactions after `pnpm privy:setup safe-rule` (see `privy-signers.md`, step 2b). Then run `smoke`. It must print `ok` for "relayer Safe execute" and for "relayer Safe execute with a refund" (refused).
4. **Privy.** External wallets on, EVM only, with "Allow new users to sign up with external wallets" off. Owners link their wallet to their existing admin account; nobody can sign up with one.

## Using it

1. **Connect your owner wallet.** On the Safe page, press **Connect wallet**. The page shows whether that wallet is an owner. Approving is a signature: it costs nothing and your wallet needs no funds.
2. **Propose.** Pick an action, fill in the fields and press **Propose**. It appears under Proposals as "Needs approvals".
3. **Approve.** Each owner opens the proposal and checks what it says.
   - The browser reads the call itself and checks the hash itself.
   - If either check fails, the card says "Don't approve it" and offers no button.
   - Press **Approve with my wallet** and confirm in the wallet. MetaMask shows the Safe transaction, with its `to`, `data` and `nonce`.
4. **Execute.** Once two owners have approved, anyone presses **Execute**. The Strimz relayer sends it and pays the fee.
5. **Scheduled role changes.**
   - The first execute only schedules the change.
   - After 48 hours, press **Propose running it** on that card.
   - Approve that new proposal with two owners, then execute it.

A proposal shows **Out of date** once the Safe has run another transaction with the same nonce. Propose it again.

### The guardian panel

Only the guardian's wallet sees it.

- **Pause Payments** and **Pause Subscriptions** act at once, with no second approval.
- **Cancel it** kills a scheduled Timelock change.

Your wallet sends these itself, because the contracts only accept them from the guardian. Each costs well under 0.01 USDC, so keep a little USDC in it. Unpausing needs two owners.

## When the admin app is down: the command line

Any owner can do the same with Foundry's `cast`. Set:

```bash
export RPC=https://rpc.mainnet.arc.io  # or https://rpc.testnet.arc.io
export SAFE=0x...                       # the Safe
```

1. **Build the call.** For example, pausing Payments:

   ```bash
   TO=0x...                                   # the Payments contract
   DATA=$(cast calldata 'pause()')
   NONCE=$(cast call $SAFE 'nonce()(uint256)' --rpc-url $RPC)
   ```

2. **Get the hash from the Safe itself:**

   ```bash
   cast call $SAFE 'getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256)(bytes32)' \
     $TO 0 $DATA 0 0 0 0 0x0000000000000000000000000000000000000000 0x0000000000000000000000000000000000000000 $NONCE \
     --rpc-url $RPC
   ```

   Both owners must see the same hash.

3. **Each owner signs** the typed data in `safe-tx.json`, with the chain ID, the Safe, `to`, `data` and `nonce` filled in:

   ```json
   {
     "types": {
       "EIP712Domain": [
         { "name": "chainId", "type": "uint256" },
         { "name": "verifyingContract", "type": "address" }
       ],
       "SafeTx": [
         { "name": "to", "type": "address" },
         { "name": "value", "type": "uint256" },
         { "name": "data", "type": "bytes" },
         { "name": "operation", "type": "uint8" },
         { "name": "safeTxGas", "type": "uint256" },
         { "name": "baseGas", "type": "uint256" },
         { "name": "gasPrice", "type": "uint256" },
         { "name": "gasToken", "type": "address" },
         { "name": "refundReceiver", "type": "address" },
         { "name": "nonce", "type": "uint256" }
       ]
     },
     "primaryType": "SafeTx",
     "domain": { "chainId": 5042, "verifyingContract": "0xSAFE" },
     "message": {
       "to": "0xTO",
       "value": "0",
       "data": "0xDATA",
       "operation": 0,
       "safeTxGas": "0",
       "baseGas": "0",
       "gasPrice": "0",
       "gasToken": "0x0000000000000000000000000000000000000000",
       "refundReceiver": "0x0000000000000000000000000000000000000000",
       "nonce": "NONCE"
     }
   }
   ```

   ```bash
   cast wallet sign --data --from-file safe-tx.json --ledger    # or --keystore <file>
   ```

   Check that the hash your wallet shows matches step 2.

4. **Join the signatures.** Put them in order of the signer's address, lowest first, and drop the `0x` from all but the first:

   ```bash
   SIGS=0x<signature of the lower address><signature of the higher address, without 0x>
   ```

5. **Send** from any wallet with a little USDC for gas:

   ```bash
   cast send $SAFE 'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)' \
     $TO 0 $DATA 0 0 0 0 0x0000000000000000000000000000000000000000 0x0000000000000000000000000000000000000000 $SIGS \
     --rpc-url $RPC --ledger
   ```

The console marks proposals at that nonce as **Out of date** on its next load.
