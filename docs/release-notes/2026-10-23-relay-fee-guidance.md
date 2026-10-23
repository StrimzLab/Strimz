---
date: 2026-10-23
feature: Relays send with no tip first, use Arc's recommended tip on retries, price from the next block's base fee, and bump same-nonce replacements by 12.5%
scope: fix
scenario-impact: none
---

# Relay tip and fee headroom per Arc's fee guidance

Fixes #245. ADR:
[ADR-2026-10-23-relay-fee-guidance](../adr/ADR-2026-10-23-relay-fee-guidance.md)
([plain-English version](../adr/ADR-2026-10-23-relay-fee-guidance-for-dummies.md)).

## What shipped

- **Tip (`GasPricingService`).**
  - The first attempt sends `maxPriorityFeePerGas = 0`, as Arc's docs advise.
  - Retries use `eth_maxPriorityFeePerGas`, read at that moment. A malformed reply fails the attempt.
- **Base fee.**
  - The price is built from the next block's base fee in the latest header's `extra_data` (8 bytes, big-endian), not the latest block's `baseFeePerGas`.
  - If `extra_data` is not 8 bytes, the attempt fails and names the block.
  - The 20,000 gwei ceiling check now applies to this value.
- **Headroom (unchanged).** `maxFeePerGas = max(2 × next base fee, 20 gwei) + tip`.
- **Replacements (`RelayJobRunner`).**
  - The broadcast record now stores `maxFeePerGas` and `maxPriorityFeePerGas`.
  - When a retry reuses the recorded nonce, both values are at least 112.5% of the recorded ones. That clears Reth's default 10% replacement rule.
  - Before, a retry rose only by 1 gwei of tip (about 2.4%), so the node could refuse it as underpriced.
  - A record from before this change has no fees and is priced as a fresh transaction.
- **Job payload (`@strimz/queue-contracts`, private).** `relayBroadcastSchema` gains the two optional decimal-string fields. Old in-flight jobs still parse.

## Numbers

- **Today on testnet:**
  - The base fee is a flat 20 gwei and `eth_maxPriorityFeePerGas` is 0.5 gwei.
  - Relays paid an effective 21 gwei. Tx `0x6418306716ac44486a43e9cf637718c1a2d727e465ff85096b8c9086ddc7b631` used 185,361 gas, so it cost 0.003892581 USDC. At tip 0 it would have cost 0.00370722 USDC, 4.8% less.
- **Pricing against the live testnet RPC:**

  | Attempt                  | Max fee   | Tip      |
  | ------------------------ | --------- | -------- |
  | First                    | 40 gwei   | 0        |
  | Retry                    | 40.5 gwei | 0.5 gwei |
  | Replacement of the first | 45 gwei   | 0.5 gwei |

## Operators

- Nothing to configure.
- **After deploy:** relay one testnet payment and check the transaction. Expect `maxPriorityFeePerGas` 0, `maxFeePerGas` 40 gwei, an effective gas price of 20 gwei, and inclusion within the 60-second receipt wait.
