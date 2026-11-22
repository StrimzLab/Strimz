---
date: 2026-11-22
feature: The indexer gets its own RPC setting; the API and scheduler get backup RPCs
scope: feature
scenario-impact: updated
---

# An RPC per service, checked at boot

ADR: [ADR-2026-11-22-rpc-per-service](../adr/ADR-2026-11-22-rpc-per-service.md).

## What changed

- **The indexer has its own setting.** It reads `INDEXER_ARC_RPC_URL` and `INDEXER_FALLBACK_RPC_URLS`. When those are unset, it keeps using `ARC_RPC_URL` and `ARC_FALLBACK_RPC_URLS`.
- **The indexer checks its range at boot.** Every endpoint it uses must answer `eth_getLogs` over `BLOCK_BATCH_SIZE` blocks, or it won't start. The error names the endpoint, with its path redacted.
- **The API and scheduler have backup RPCs.** They read `ARC_FALLBACK_RPC_URLS` and fail over in order, through viem's `fallback` transport. This covers the relayer, the subscription writes and the refund wallet. At boot, in production, every endpoint must serve the configured chain.
- **Keys stay out of logs.** RPC URLs show only their origin in logs and in viem's error messages. viem is given the origin, and the keyed URL is used only at fetch time. This fixes the indexer's "indexer starting" log, which printed the full `ARC_RPC_URL`.

## Before deploying

- **Remove dRPC from the testnet server's `ARC_FALLBACK_RPC_URLS`.** Its free plan rejects 500-block `eth_getLogs`, so the indexer would refuse to start.

  Checked on 2026-11-22:

  | Endpoint                         | 500-block probe |
  | -------------------------------- | --------------- |
  | `rpc.testnet.arc.io`             | passes          |
  | `rpc.quicknode.testnet.arc.io`   | passes          |
  | `rpc.blockdaemon.testnet.arc.io` | passes          |
  | `rpc.drpc.testnet.arc.io`        | fails           |

- **Mainnet settings:**

  ```
  ARC_RPC_URL=<Alchemy mainnet>
  ARC_FALLBACK_RPC_URLS=<QuickNode mainnet>,https://rpc.mainnet.arc.io
  INDEXER_ARC_RPC_URL=https://rpc.mainnet.arc.io
  ```

  On mainnet, the probe accepts `rpc.mainnet.arc.io` and refuses the free QuickNode and Alchemy endpoints.

## Tests

- **Indexer (Go):**
  - which settings it reads;
  - an RPC setting is required;
  - the range probe passes or fails as expected, queries one batch ending at head, and never shows the key.
- **API and scheduler:**
  - the fallback list is parsed and validated;
  - the transport tries endpoints in order;
  - URLs are redacted;
  - an endpoint on the wrong chain stops boot, named by host;
  - viem errors never carry the key;
  - the chain-id check covers every fallback.
