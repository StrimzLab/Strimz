# ADR for Dummies: When a refund is really dead, and telling the merchant

- **Status:** Accepted 2026-11-13
- **Date:** 2026-11-13

## The Idea

Sometimes a refund transaction never makes it onto the blockchain. Today it sits on "Submitted" forever, and the merchant can't refund that customer again.

We can't simply give up after a while. The signed transaction could still be sent later, and then the customer would be refunded twice. But there is a safe test: every transaction from a wallet carries a sequence number. Once that wallet has used the number for something else, the old transaction can never happen. Strimz will watch for that, and only then mark the refund as failed.

Merchants will also get a new webhook, `refund.failed`, whenever a refund fails for any reason. Their own systems can then react without checking the dashboard.

## What the Person Sees

1. A merchant sends a refund, but the transaction gets stuck or replaced in their wallet.
2. As soon as the wallet moves on, the refund changes from **Submitted** to **Failed**, with the reason "transaction was replaced or dropped".
3. The amount is freed, so the merchant can issue the refund again.
4. Their server receives a `refund.failed` webhook with the reason. The same happens when a refund fails for other reasons, such as a reverted transfer.

## Important Limitation

If no part of the network ever saw the transaction, Strimz can't prove it is dead, so the refund stays on **Submitted**. This is rare, and it is safer than risking a double refund.

## What Changes

- Stuck refunds whose transaction was replaced now end as **Failed**.
- New `refund.failed` webhook, selectable on webhook endpoints and described in the docs.
- One small database change, to allow the new webhook type.

## What Does Not Change

- How merchants issue and sign refunds.
- The existing `refund.created` and `refund.completed` webhooks.
- The contracts.
