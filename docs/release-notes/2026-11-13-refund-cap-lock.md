---
date: 2026-11-13
feature: The refund cap holds when refunds of one payment arrive together
scope: fix
scenario-impact: none
---

# Refund cap under concurrency

Refunds of one payment that arrived at the same moment could all pass the cap: in the
2026-11-12 stress run, 7 of 10 concurrent 60% refunds were accepted. Now the second and
later requests see the first and get the usual `400 invalid_request`.

`RefundsService.create` locks the refunded `Transaction` row (`FOR UPDATE`) in one
database transaction with the cap check and the insert. Refunds of different payments
don't wait for each other. A request that waits more than 5 s for the lock answers
`409 refund_in_progress`, a new retryable code in the error docs. `refund.created` still
fires only after the refund is saved.

ADR: `docs/adr/ADR-2026-11-13-refund-cap-lock.md`.

## Existing over-cap refunds (choice C3)

Left as they are. To list them for review:

```sql
SELECT t.id, t.amount, sum(r.amount::numeric) AS reserved
FROM "Transaction" t
JOIN "Refund" r ON r."transactionId" = t.id
WHERE r.status IN ('pending', 'awaiting_signature', 'submitted', 'completed')
GROUP BY t.id, t.amount
HAVING sum(r.amount::numeric) > t.amount::numeric;
```
