# `@strimz/indexer`

Strimz on-chain indexer. Polls the Arc RPC for new blocks, decodes events emitted by the Strimz contract suite, and projects them into the shared Postgres database.

## Responsibilities

| Source event                              | Effect on Postgres                                              |
| ----------------------------------------- | --------------------------------------------------------------- |
| `StrimzRegistry.MerchantRegistered`       | Sets `Merchant.onchainMerchantId` on the row matching `payoutAddress` |
| `StrimzPayments.PaymentExecuted`          | Inserts a `Transaction(kind=one_shot)`, links to `PaymentSession` if the `bytes32 ref` matches a session id, flips session status to `confirmed` |
| `StrimzSubscriptions.SubscriptionCancelled` | Marks the matching `Subscription` row `cancelled` (idempotent with the API path) |
| `ERC-20 Transfer` matching `Refund.refundTxHash` | Flips refund `submitted → completed`                       |
| `StrimzAgentEscrow.JobCreated`            | Links `AgentJob.onchainJobId` and stores the escrow tx hash      |
| `StrimzAgentEscrow.JobReleased`           | Marks the job `released` and records the release tx hash         |

`SubscriptionCreated`/`Charged`/`ChargeSkipped`, `Job{Funded,Started,Delivered,Approved,Disputed,Cancelled}`, and `FeeAccrued` are decoded but not yet projected; they'll surface as audit-log entries in M2.

## Architecture

```
cmd/indexer            CLI entrypoint (cobra)
internal/config        envconfig + structural validation
internal/abi           hand-rolled event decoders (no abigen)
internal/chain         go-ethereum ethclient wrapper + block-range filter
internal/store         pgxpool, IndexerCursor checkpoint, projection writes
internal/processor     polling loop + event dispatch
internal/health        /healthz, /readyz, /metrics
```

The indexer is a *derived* view — truncating `IndexerCursor` and reprocessing from genesis must produce identical Postgres state. Every projection is `INSERT ... ON CONFLICT DO NOTHING` (or update-by-natural-key) so replays are safe.

## Reorg protection

The indexer waits for `CONFIRMATIONS` blocks (default 5) before projecting. `safeHead = head - CONFIRMATIONS`. We never read past it. For deeper reorgs you'd extend the indexer with a hash-chain check on the previous block; M1 trusts Arc's finality guarantees.

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
