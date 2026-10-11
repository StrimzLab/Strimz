---
date: 2026-10-11
feature: Relays price gas up to Arc's maximum base fee and report fee read failures; the scheduler hands out its own nonces and signs for the configured chain
scope: fix
scenario-impact: none
---

# Arc gas pricing and scheduler nonces

Fixes #141. ADR:
[ADR-2026-10-11-arc-gas-and-nonces](../adr/ADR-2026-10-11-arc-gas-and-nonces.md)
([plain-English version](../adr/ADR-2026-10-11-arc-gas-and-nonces-for-dummies.md)), G1 to
G6 as recommended. The chain-id boot check the issue also asked for shipped in #138.

## What shipped

- **Relayer gas (`GasPricingService`).**
  - The 200 gwei clamp on `maxFeePerGas` is gone. Above 200 gwei of base fee, every
    relay used to be priced below the base fee and never included. Now the price is
    `max(2 × baseFee + tip, 20 gwei + tip)`.
  - A base fee above Arc's documented maximum (20,000 gwei) throws, naming the reading.
  - A failed block read, or a block without `baseFeePerGas`, now fails the attempt, and
    the relay job retries it. Before, it was hidden behind a floor-priced transaction.
- **Scheduler (`ChainService`).**
  - The account carries viem's nonce manager, so concurrent writes in the process get
    consecutive nonces. Before, the charge and agent workers could both read the same
    pending nonce.
  - Every write passes the configured chain instead of `chain: null`. Transactions are
    signed for `ARC_ENVIRONMENT`'s chain id whatever the RPC reports, so another chain's
    node rejects them.
  - Fee estimation is unchanged (viem's estimate, no cap).

## Operator steps

None. Costs, from testnet `registerMerchant` transactions (84,420 gas used each):

- today, at the 20 gwei base fee: about 0.0018 USDC per registration;
- at Arc's 20,000 gwei ceiling, the worst case: about 1.7 USDC.

`RelayBudgetService` still records each relay's gas against its merchant. To be
accepted at the ceiling, a 300,000-gas-limit registration needs about 12 USDC in the
relayer's balance (gas limit × `maxFeePerGas`), so keep the relayer funded above that.

## Verification

- On 2026-10-11 both `rpc.testnet.arc.io` and `rpc.mainnet.arc.io` report a 20 gwei base
  fee over the last 20 blocks.
- `apps/api/test/unit/modules/relay/gas-pricing.test.ts`:
  - five new cases, red before the fix: a 500 gwei and a 20,000 gwei base fee priced
    without a clamp; a base fee above the maximum refused; a missing base fee and an RPC
    failure rejected;
  - they replace "clamps maxFeePerGas at the safety cap", "falls back to the floor when
    the RPC has no baseFeePerGas" and "does not crash when the chain client throws".
- `apps/scheduler/test/unit/chain-writes.test.ts` (new): the real `ChainService` and
  viem against a local JSON-RPC server.
  - On `main` two concurrent `batchCharge` calls both signed nonce 7, and a write was
    signed for chain 1 when the RPC reported chain 1.
  - Now the nonces are 7 and 8, and the write is signed for 5042002.
- API unit 267 and e2e 314; scheduler unit 101 and e2e 44; `./scripts/preflight.sh` in
  full.
- Still to do after the next testnet redeploy: one relayed payment and one subscription
  charge, with their transaction hashes added here.
