# ADR: Check the refund cap under a lock on the refunded transaction

- **Status:** Approved by the maintainer on 2026-11-13, with the recommended choices
- **Date:** 2026-11-13
- **Scope:** `apps/api` `RefundsService.create`, and one new error code in the error docs. No contract, Prisma migration, job payload, webhook payload or published package changes.

## Context

A merchant may refund a transaction in parts, but never more than its amount in total.
`RefundsService.create` enforces this in three separate steps:

1. `refund.findMany` for the transaction's refunds in `pending`, `awaiting_signature`,
   `submitted` or `completed`, summed as `bigint`;
2. compare the sum plus the request against the transaction amount;
3. `refund.create`.

Nothing serializes these steps. Requests that arrive together all read the same sum, all
pass, and all insert.

Proof:

- `apps/api/test/e2e/refunds.e2e.test.ts` › "enforces the cumulative cap when refunds
  arrive at the same time", failing on `main` at `b23a88d`: ten concurrent 60% refunds of
  one 100 USDC transaction, and two are accepted (120%).
- The 2026-11-12 stress run (`e2e/full-stack/stress`, S4) against the real stack: 7 of 10
  accepted, 420% of the payment reserved.

Impact: the merchant signs each refund transfer from their own wallet, so Strimz moves no
money. But the cap is the guard against a merchant integration that retries or
double-clicks into refunding a payer several times, and the records, dashboard totals and
`refund.created` webhooks show refunds that exceed the payment.

## Decision

1. **Lock the transaction row.** `create` runs in one `prisma.$transaction` (read committed)
   that first takes `SELECT id FROM "Transaction" WHERE id = $1 AND "merchantId" = $2 FOR UPDATE`.
   The cap sum and the insert run inside it, after the lock.
2. **The lock is per transaction.** Refunds of different transactions don't wait for each
   other; refunds of the same one run one at a time.
3. **Existing checks keep their order and answers.** Not found, not confirmed and over the
   cap still answer `404 not_found`, `403 session_invalid_state` and `400 invalid_request`
   with the same bodies.
4. **`refund.created` fires after the commit**, as today it fires after the insert, so a
   rolled-back request never sends it.
5. **Lock wait is bounded.** The transaction sets `lock_timeout = '5s'`. A request that
   can't get the lock in time answers `409 refund_in_progress`, a new code documented in
   `apps/web/content/docs/errors.mdx` as retryable. Requests that only read and insert hold
   the lock for milliseconds, so this should not be seen in practice.

## Diagram

```mermaid
sequenceDiagram
    participant A as Refund request A
    participant B as Refund request B
    participant PG as Postgres
    A->>PG: BEGIN; SELECT Transaction FOR UPDATE
    B->>PG: BEGIN; SELECT Transaction FOR UPDATE (waits)
    A->>PG: sum open refunds = 0; 0 + 60 <= 100; INSERT refund
    A->>PG: COMMIT
    PG-->>B: lock granted
    B->>PG: sum open refunds = 60; 60 + 60 > 100
    B->>PG: ROLLBACK, answer 400 invalid_request
```

## Consequences

- The cap holds under any concurrency, on one api instance or many, because the lock is in
  Postgres.
- Refunds of one transaction are serialized. Merchants don't refund one payment many times
  a second, so this costs nothing in practice.
- Each refund creation holds one row lock for a few milliseconds.

## Alternatives considered

- **`SERIALIZABLE` isolation with retry.** Works, but every caller needs retry logic for
  serialization failures, and a retry loop is easier to get wrong than one lock.
- **A database constraint.** A cap on a sum across rows can't be a plain constraint; a
  trigger would hide the rule from the api code that owns it.
- **An in-memory or Redis lock.** In memory breaks with several instances; Redis adds a
  second system to keep consistent with Postgres.
- **A running `refundedAmount` column on `Transaction`.** Needs a migration and a backfill
  for the same guarantee the lock gives.

## Verification

- **Red, already written:** the concurrent test named above.
- **Green:**
  - it passes: one `201`, nine `400`, 60 USDC reserved;
  - the existing refund tests pass unchanged, including the sequential cap test;
  - new: concurrent refunds of two different transactions both succeed;
  - new: a request held past `lock_timeout` answers `409 refund_in_progress`.
- Stress S4 passes: at most one of ten concurrent 60% refunds is accepted.
- `./scripts/preflight.sh` passes in full.
