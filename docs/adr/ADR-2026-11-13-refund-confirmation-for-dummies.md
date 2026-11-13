# ADR for Dummies: Refunds that finish on their own and check what was sent

- **Status:** Accepted 2026-11-13
- **Date:** 2026-11-13

## The Idea

When a merchant refunds a payment, Strimz waits to see the money arrive before marking the refund done. Today two things can go wrong.

- **The money arrives too fast.** Arc is quick enough that the money can land before Strimz is told which transaction to look for, so the refund sits on "submitted" forever.
- **Strimz doesn't check the transfer.** It only checks that some transfer happened, not that the right amount of the right coin went to the right person.

This change adds a background check every few seconds, and both checks now compare the coin, the recipient and the amount.

## What the Person Sees

1. The merchant clicks **Refund**, signs, and the refund shows **Submitted**.
2. Within a second or two, or at most about 15 seconds, it changes to **Completed**, and their webhook receives `refund.completed` once.
3. If the transfer failed on-chain, or sent the wrong amount, coin or recipient, the refund shows **Failed** instead of staying stuck. The merchant can then issue the refund again.
4. Refunds that are already stuck on **Submitted** today fix themselves the first time the new check runs.

## Important Limitation

If a transaction is never picked up by the network at all, the refund stays on **Submitted** and its amount stays reserved. Deciding how long to wait before giving up is a separate piece of work.

## What Changes

- Stuck refunds complete on their own.
- A refund is marked completed only when the right coin, the right amount and the right customer all match.
- Failed or mismatched transfers show as **Failed** instead of **Submitted**.
- A new background job in the scheduler, checking every 15 seconds by default.

## What Does Not Change

- How a merchant issues and signs a refund.
- The database layout, the smart contracts, and the API.
- Webhooks: still one `refund.completed` per refund, with the same contents.
- There is no new `refund.failed` webhook yet, and the refunds page doesn't show the failure reason yet. Both are filed as follow-up issues.
