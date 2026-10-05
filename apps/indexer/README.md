# `@strimz/indexer`

Strimz on-chain indexer. Polls the Arc RPC for new blocks, decodes events emitted by the Strimz contract suite, and projects them into the shared Postgres database.

## Responsibilities

### Registry events

| Source                         | Effect on Postgres                                                     |
| ------------------------------ | ---------------------------------------------------------------------- |
| `MerchantRegistered`           | Sets `Merchant.onchainMerchantId` on the row matching `payoutAddress`  |
| `MerchantPayoutAddressUpdated` | Updates `Merchant.payoutAddress`                                       |
| `MerchantActiveSet`            | Flips `Merchant.status` between `active` / `suspended`                 |
| `MerchantFeeBpsUpdated`        | Records to `AuditLog` (fee bps lives elsewhere in the off-chain model) |

`MerchantOwnerTransferred` (emitted only by the one-step transfer removed in #68) stays in
the embedded registry ABI so a stray log decodes, but it is not subscribed and writes
nothing.

### Merchant governance events

Each event writes one `AuditLog` row with category `merchant` and `targetType` `Merchant`.
When the on-chain merchant id is linked, `merchantId` and `targetId` are the `Merchant`
row's id; when it is not, `merchantId` is null and `targetId` is `onchain:<id>`. The log
is never parked. No `Merchant` column changes.

| Source                               | `action`                                        | Extra `metadata`                        |
| ------------------------------------ | ----------------------------------------------- | --------------------------------------- |
| `MerchantOwnershipTransferInitiated` | `merchant.ownership_transfer_initiated_onchain` | `currentOwner`, `pendingOwner`          |
| `MerchantOwnershipTransferAccepted`  | `merchant.ownership_transfer_accepted_onchain`  | `previousOwner`, `newOwner`             |
| `MerchantOwnershipTransferCancelled` | `merchant.ownership_transfer_cancelled_onchain` |                                         |
| `MerchantPayoutChangeInitiated`      | `merchant.payout_change_initiated_onchain`      | `newPayoutAddress`, `commitAt` (unix s) |
| `MerchantPayoutChangeCancelled`      | `merchant.payout_change_cancelled_onchain`      |                                         |
| `MerchantMaxFeeBpsLowered`           | `merchant.max_fee_bps_lowered_onchain`          | `newMaxFeeBps`                          |

Both `...Initiated` events also log a `warn` line with the on-chain merchant id and the
new address, for log-based alerting on an unexpected change
(`docs/runbooks/merchant-ownership-transfer.md`).

### Payments (one-shot)

| Source            | Effect on Postgres                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `PaymentExecuted` | Inserts `Transaction(kind=one_shot)`; links the `bytes32 ref` to a `PaymentSession` and flips it to `confirmed` |

### Subscriptions

| Source                      | Effect on Postgres                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SubscriptionCreated`       | Upserts `Customer` by `(merchantId, walletAddress)`, find-or-creates a `SubscriptionPlan` matching `(merchantId, amount, currency, interval)`, inserts a `Subscription` row            |
| `SubscriptionCharged`       | Inserts a `SubscriptionCharge` (idempotent on `chargeAttemptId`), inserts a linked `Transaction(kind=subscription_charge)`, advances `Subscription.nextChargeAt` and the period window |
| `SubscriptionChargeSkipped` | Inserts a `SubscriptionCharge(status=failed, outcome=...)` and flips the `Subscription` to `at_risk`                                                                                   |
| `SubscriptionCancelled`     | Marks the matching `Subscription` row `cancelled` (idempotent with the API path)                                                                                                       |

### Agent escrow (full ERC-8183 lifecycle)

| Source                         | Effect on Postgres                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `JobCreated`                   | Links `AgentJob.onchainJobId` and `escrowTxHash`; flips status to `in_progress`; appends to `AuditLog` |
| `JobFunded`                    | Appends to `AuditLog` (no AgentJob field for funded amount)                                            |
| `JobStarted` / `JobDelivered`  | Updates `AgentJob.status`; `JobDelivered` records `deliverableHash`                                    |
| `JobApproved`                  | Updates `AgentJob.status`; appends to `AuditLog` with assessor                                         |
| `JobReleased`                  | Sets `AgentJob.status=completed`, records `releaseTxHash` and `completedAt`                            |
| `JobDisputed` / `JobCancelled` | Updates `AgentJob.status`; appends to `AuditLog` with the reason                                       |

### Fees

| Source       | Effect on Postgres                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `FeeAccrued` | Appends to `AuditLog` scoped to the merchant. The on-chain ledger is the source of truth; this is just a denormalised view for the dashboard. |

### Contract operations

Each event writes one `AuditLog` row with category `admin`, a null `merchantId`,
`targetType` `Contract` and `targetId` the emitting contract's lowercase address.

| Source                                    | `action`                                                        | Extra `metadata`                                     |
| ----------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| `Paused` / `Unpaused`                     | `contract.paused` / `contract.unpaused`                         | `account`                                            |
| `DependencyUpdated`                       | `contract.dependency_updated`                                   | `name`, `newAddress`                                 |
| `FeeWithdrawn`                            | `fees.withdrawn`                                                | `token`, `to`, `amount` (base units, decimal string) |
| `TokenAdded` / `TokenRemoved` (whitelist) | `token_whitelist.token_added` / `token_whitelist.token_removed` | `token`                                              |
| `TokenCapabilitiesSet` (whitelist)        | `token_whitelist.capabilities_set`                              | `token`, `capabilities`                              |

A `TokenAdded` for a token that is not in `STABLECOIN_ADDRESSES` also logs an `error`
line: that token's payments park until the config lists it.

Every row from these two sections, merchant governance and contract operations, has the
id `onchain:<chainId>:<txHash>:<logIndex>` and is inserted with
`ON CONFLICT (id) DO NOTHING`, so replaying a range does not write it twice. The other
audit rows (`fees.accrued`, `merchant.fee_bps_changed_onchain`, agent job events) still
use random ids.

Role, upgrade and agent registry events (`RoleGranted`, `RoleRevoked`, `RoleAdminChanged`,
`Upgraded`, the `StrimzAgentRegistry` events) are not indexed; see #211.

### Refunds (via ERC-20 Transfer)

| Source                                    | Effect on Postgres                   |
| ----------------------------------------- | ------------------------------------ |
| `Transfer` matching `Refund.refundTxHash` | Flips refund `submitted → completed` |

## Architecture

```
cmd/indexer            CLI entrypoint (cobra)
internal/config        envconfig + structural validation
internal/abi           ABI JSON files (committed) + dynamic decoder via go:embed
internal/chain         go-ethereum ethclient wrapper + block-range filter + block-time resolver
internal/store         pgxpool, IndexerCursor checkpoint, idempotent projection writes
internal/processor     polling loop + event dispatch (per-batch block-time cache)
internal/health        /healthz, /readyz, /metrics
```

## Refreshing ABIs after a contract change

```bash
make abi    # rebuilds internal/abi/*.abi.json from packages/contracts/out/
```

This runs `forge build` if needed, then extracts each contract's `events` array via `jq` into the embedded JSON files. The Go binary picks them up via `//go:embed` at build time, so there are no runtime filesystem reads.

The indexer is a derived view. Truncating `IndexerCursor` and
reprocessing from genesis must produce identical Postgres state.
Every projection is `INSERT ... ON CONFLICT DO NOTHING` or
update-by-natural-key, so replays are safe.

## Reorg protection

The indexer stays `CONFIRMATIONS` blocks behind the chain head
(required, `1` on both Arc networks). `safeHead = head - CONFIRMATIONS`; the loop never
reads past it. For deeper reorg protection you'd extend the indexer
with a hash-chain check on the previous block. M1 trusts Arc's
finality guarantees.

## Configuration

See `.env.example`. Every variable is required unless it has a default.

One indexer process indexes one chain, configured by its own env file. These have no
default and fail boot with the variable named when missing or malformed:

| Variable                  | Meaning                                                                                 | Arc testnet                                  | Arc mainnet  | Local anvil (compose) |
| ------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- | ------------ | --------------------- |
| `ARC_CHAIN_ID`            | Chain id the RPC endpoints must serve. Positive integer.                                | `5042002`                                    | `5042`       | `31337`               |
| `START_BLOCK`             | Block the core contracts were deployed at, `>= 1`. Where a fresh cursor starts.         | `51147731`                                   | deploy block | `1`                   |
| `CONFIRMATIONS`           | Blocks to stay behind head. Any non-negative integer.                                   | `1`                                          | `1`          | `0`                   |
| `TOKEN_WHITELIST_ADDRESS` | `TokenWhitelist` proxy. Watched in the same ordered stream as the other core contracts. | `0xc907412e31a35fcfac9336285a34c0007425066c` | deploy       | your deploy           |

At boot the indexer calls `eth_chainId` on `ARC_RPC_URL` and on every
`ARC_FALLBACK_RPC_URLS` entry before it opens the database:

- an endpoint that answers with another chain id fails boot; the error names the
  endpoint (path redacted), the id it returned and `ARC_CHAIN_ID`;
- an endpoint whose `eth_chainId` call errors is dropped from the failover set with a
  `warn` line;
- boot fails if no endpoint is left.

`ARC_CHAIN_ID` is checked against the RPC, not against `ARC_ENVIRONMENT`. An env file that
pairs `ARC_ENVIRONMENT=testnet` with mainnet RPCs and `ARC_CHAIN_ID=5042` boots and projects
in test mode, so review the pairing when you write the file.

### One database per network

`IndexerCursor` is keyed by `(chainId, contractAddress)` and `IndexerDeadLetter` by
`(chainId, txHash, logIndex)`; the indexer reads, retries and counts only the rows of its
own chain. The projection tables (`Merchant.onchainMerchantId`, `Transaction`,
`Subscription`, ...) are not chain-scoped, so two networks must never share a database.
The deployment rule is one database per network: Arc testnet and Arc mainnet each run
their own indexer, env file and Postgres database.

## Running

```bash
# Local: requires `pnpm prisma migrate deploy` to have been run against DATABASE_URL
make dev

# Production: built into a distroless image
docker build -t strimz-indexer .
```

## Testing

```bash
make test          # unit tests, no Docker
make test-e2e      # spins up Postgres via testcontainers, applies migrations
```

The `e2e` build tag gates tests that need Docker. CI runs both.
