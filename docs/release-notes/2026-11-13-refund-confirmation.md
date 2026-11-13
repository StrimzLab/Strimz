---
date: 2026-11-13
feature: Refunds complete from a verified transfer and no longer stick on submitted
scope: fix
scenario-impact: needs_automation
---

# Refund confirmation

A refund sent from the dashboard stayed on "submitted" forever. Arc confirmed the transfer before the browser told the API the transaction hash, so the indexer saw the transfer, found no refund with that hash, and moved on. The indexer also completed a refund for any stablecoin transfer in that transaction, without checking the token, recipient or amount.

See `docs/adr/ADR-2026-11-13-refund-confirmation.md`.

- The indexer completes a refund only when the transfer is in the refund's currency, goes to the payer, and is for the exact amount.
- A new scheduler job, `refund-reconciler`, runs every 15 seconds (`REFUND_RECONCILER_CRON`). It reads the receipt of every submitted refund:
  - if the receipt has a matching transfer, it completes the refund;
  - if the transaction reverted or paid the wrong thing, it marks the refund failed with a reason;
  - if there is no receipt yet, it waits for the next run.
- `refund.completed` still fires once per refund, whichever of the two completes it.
- Refunds already stuck on "submitted" are fixed by the job's first run.

Follow-ups: #439 (a transaction that never gets a receipt), #440 (a `refund.failed` webhook), #441 (show the failure reason in the dashboard).

The race needs a live chain to reproduce, so it is marked `needs_automation`.
