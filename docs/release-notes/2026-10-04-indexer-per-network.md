---
date: 2026-10-04
feature: The indexer is bound to one chain, keys its bookmarks by chain, and records every governance and contract-operation event
scope: feat
scenario-impact: needs_automation
---

# Indexer: one chain per process, chain-keyed bookmarks, every emitted event

An indexer process now indexes exactly one chain, named by `ARC_CHAIN_ID`, and refuses to
start if any of its RPC endpoints serves another chain. Its bookmarks and parked logs are
keyed by chain id. It also records the merchant ownership and payout-change events, the
pause, dependency and fee-withdrawal events, and the token whitelist's events, which it
ignored before.

Closes #143. ADR: [ADR-2026-10-04-indexer-per-network](../adr/ADR-2026-10-04-indexer-per-network.md)
([plain-English version](../adr/ADR-2026-10-04-indexer-per-network-for-dummies.md)).

## What was wrong

- Nothing checked which chain the RPC endpoints served. A fallback on the wrong network
  was indexed as if it were right and advanced the real cursor.
- `CONFIRMATIONS` defaulted to `5` and `START_BLOCK` to `0`, so an env file that forgot
  them ran on silent defaults, and a fresh mainnet indexer would scan from genesis.
- `IndexerCursor` was keyed by `contractAddress` alone and `IndexerDeadLetter` was unique
  on `(txHash, logIndex)` and retried by environment. The same database pointed at a
  second chain resumed the other chain's cursor and retried its parked logs.
- `MerchantOwnershipTransferInitiated`, `...Accepted`, `...Cancelled`,
  `MerchantPayoutChangeInitiated`, `MerchantPayoutChangeCancelled`,
  `MerchantMaxFeeBpsLowered`, `Paused`, `Unpaused`, `DependencyUpdated` and `FeeWithdrawn`
  were not indexed, and `TokenWhitelist` was not watched at all. The merchant ownership
  runbook asks operations to react to an unexpected `...Initiated` event that nothing
  recorded.

## What shipped

- **Configuration.** `ARC_CHAIN_ID`, `START_BLOCK`, `CONFIRMATIONS` and
  `TOKEN_WHITELIST_ADDRESS` are required with no default. A missing or malformed value
  fails boot with the variable named. `ARC_CHAIN_ID` must be an integer in
  `[1, 2147483647]` (it is stored in an `INTEGER` column); `START_BLOCK` must be `>= 1`.
- **Chain id check at boot.** Before the database is opened, the indexer calls
  `eth_chainId` on `ARC_RPC_URL` and every `ARC_FALLBACK_RPC_URLS` entry. A different
  chain id fails boot naming the endpoint (path redacted), the id returned and the id
  configured. An endpoint whose call errors is dropped with a `warn` line; boot fails if
  none is left. A successful check logs `rpc endpoints verified` with the chain id.
- **Chain-keyed bookmarks and parked logs.** `IndexerCursor` primary key is
  `(chainId, contractAddress)`; `IndexerDeadLetter` is unique on
  `(chainId, txHash, logIndex)` with retry index `(chainId, resolvedAt, blockNumber)`. The
  stream cursor, the stablecoin cursors, the cutover's legacy-cursor read, dead-letter
  parking, retry, the `/readyz` dead-letter count and the freshness monitor all filter by
  the runner's chain id. `environment` stays on both tables as a label.
- **Merchant governance audit rows.** The six registry events above write one `AuditLog`
  row each (category `merchant`, `targetType` `Merchant`). A linked merchant's row carries
  its `merchantId`; an unlinked merchant's row has a null `merchantId` and `targetId`
  `onchain:<id>`, and the log is never parked. Both `...Initiated` events also log a
  `warn` line with the on-chain merchant id and the new address. No `Merchant` column and
  no webhook changes.
- **Contract-operation audit rows.** `Paused`, `Unpaused`, `DependencyUpdated`,
  `FeeWithdrawn`, `TokenAdded`, `TokenRemoved` and `TokenCapabilitiesSet` write one
  `AuditLog` row each (category `admin`, `targetType` `Contract`, `targetId` the emitting
  contract's lowercase address). A `TokenAdded` for a token missing from
  `STABLECOIN_ADDRESSES` also logs an `error` line.
- **Idempotent audit rows.** Every row above has the id
  `onchain:<chainId>:<txHash>:<logIndex>` and is inserted `ON CONFLICT (id) DO NOTHING`.
  The older audit rows (`fees.accrued`, `merchant.fee_bps_changed_onchain`, agent job
  events) keep random ids.
- **Token whitelist watched.** `TokenWhitelist.abi.json` is embedded (`make abi` now
  includes it) and `TOKEN_WHITELIST_ADDRESS` is part of the ordered core stream.
- **Legacy owner event retired.** `MerchantOwnerTransferred` is no longer subscribed or
  projected. It stays in the embedded registry ABI, so a stray log decodes by name and is
  skipped with a warning. Any embedded event that is not subscribed now decodes this way
  instead of failing as a decode error.
- Migration `20261004120000_indexer_chain_id`.

## Deployment rule: one database per network

The bookmarks are chain-keyed, but the projection tables (`Merchant.onchainMerchantId`,
`Transaction`, `Subscription`, ...) are not. Arc testnet and Arc mainnet each run their
own indexer, env file and Postgres database. Never point two networks at one database.

## New required environment variables

| Variable                  | Arc testnet (Lightsail)                      | Arc mainnet                        | Local compose (anvil) |
| ------------------------- | -------------------------------------------- | ---------------------------------- | --------------------- |
| `ARC_CHAIN_ID`            | `5042002`                                    | `5042`                             | `31337`               |
| `START_BLOCK`             | `51147731` (already set)                     | the core contracts' deploy block   | `1`                   |
| `CONFIRMATIONS`           | `1` (already set)                            | `1`                                | `0`                   |
| `TOKEN_WHITELIST_ADDRESS` | `0xc907412e31a35fcfac9336285a34c0007425066c` | the mainnet `TokenWhitelist` proxy | your deploy           |

`ARC_CHAIN_ID` is checked against the RPC, not against `ARC_ENVIRONMENT`; check that the
pair matches when you write the env file.

## Deploy

Order: migrate, then start the new indexer with the new env.

1. Before deploying, add `ARC_CHAIN_ID=5042002` and
   `TOKEN_WHITELIST_ADDRESS=0xc907412e31a35fcfac9336285a34c0007425066c` to the Lightsail
   `.env` (see `infra/lightsail/env.example`). Confirm `START_BLOCK` and `CONFIRMATIONS`
   are present. Without them the new indexer exits at boot naming the variable.
2. Migrate: `prisma migrate deploy`. On Lightsail, `deploy.sh` stops the old container
   and the new container's entrypoint runs it before supervisord starts any service. The
   migration adds `chainId`, sets it to `5042002` on every `testnet` row and `5042` on
   every `mainnet` row, makes it `NOT NULL` and swaps the keys. The `strimz-core` cursor,
   the stablecoin cursors, the five pre-#188 cursors and every dead letter keep their
   blocks and hashes.
3. Start the new indexer with the new env (supervisord does this on Lightsail). A
   pre-change indexer binary cannot write to the migrated tables, so the old one must
   not run after step 2.

After deploy, check on testnet: the log line `rpc endpoints verified` with
`chainId 5042002`; `strimz-core` resumes from its previous block (no rescan from
`START_BLOCK`); `/readyz` reports the same dead-letter count as before; a test
`transferMerchantOwnership` on a test merchant writes one
`merchant.ownership_transfer_initiated_onchain` row and a `warn` line.

A developer database that indexed anvil under `testnet` gets `chainId 5042002` on its
rows. With `ARC_CHAIN_ID=31337` the local indexer then starts fresh from `START_BLOCK`.

## Events before the deploy block

The stream resumes from its existing cursor, so governance, contract-operation and
whitelist events emitted before the deploy are not backfilled. To record them, stop the
indexer, set the `strimz-core` cursor's `lastProcessedBlock` back and clear its
`lastBlockHash`, then start it. The new audit rows are idempotent, but `fees.accrued`,
`merchant.fee_bps_changed_onchain` and agent job audit rows are not and would be written
again for the replayed range.

## Rollback

The migration is forward only. To roll back, stop the indexer, run the SQL below, then
start the previous indexer binary. This works only while no second chain's rows exist in
either table.

```sql
BEGIN;
DROP INDEX "IndexerDeadLetter_chainId_resolvedAt_blockNumber_idx";
CREATE INDEX "IndexerDeadLetter_environment_resolvedAt_blockNumber_idx"
  ON "IndexerDeadLetter"("environment", "resolvedAt", "blockNumber");
DROP INDEX "IndexerDeadLetter_chainId_txHash_logIndex_key";
CREATE UNIQUE INDEX "IndexerDeadLetter_txHash_logIndex_key"
  ON "IndexerDeadLetter"("txHash", "logIndex");
ALTER TABLE "IndexerDeadLetter" DROP COLUMN "chainId";
ALTER TABLE "IndexerCursor" DROP CONSTRAINT "IndexerCursor_pkey";
ALTER TABLE "IndexerCursor" ADD CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("contractAddress");
ALTER TABLE "IndexerCursor" DROP COLUMN "chainId";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261004120000_indexer_chain_id';
COMMIT;
```

The audit rows written by the new projections stay; the previous binary does not read
them.

## Not in this change

- Role, upgrade and agent registry events (`RoleGranted`, `RoleRevoked`,
  `RoleAdminChanged`, `Upgraded`, and the `StrimzAgentRegistry` events) are not indexed.
  On-chain admin monitoring with alerting for them is tracked in #211.
- The `@strimz/shared-config` mainnet constants (`ARC_MAINNET_CHAIN_ID = 5040001`,
  `rpc.arc.network`) are wrong; they are fixed separately in #138. The indexer does not
  read them.
- Moving `fees.accrued`, `merchant.fee_bps_changed_onchain` and agent job audit rows to
  deterministic ids.
