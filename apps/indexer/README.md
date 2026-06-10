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
| `MerchantOwnerTransferred`     | Records to `AuditLog`                                                  |

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
(default 5). `safeHead = head - CONFIRMATIONS`; the loop never
reads past it. For deeper reorg protection you'd extend the indexer
with a hash-chain check on the previous block. M1 trusts Arc's
finality guarantees.

## Configuration

See `.env.example`. Every variable is required unless it has a default.

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
