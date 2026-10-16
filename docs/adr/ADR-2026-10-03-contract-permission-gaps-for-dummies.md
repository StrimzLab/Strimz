# ADR for Dummies: Close six permission gaps in the contracts before the redeploy

- **Status:** Accepted 2026-10-03
- **Date:** 2026-10-03

## The Idea

A review found six places where the contracts let the wrong person do the right thing,
or the right person do it at the wrong time. Most are about who controls a merchant's
money. We fix them all in the contract redeploy that is already planned, so the
external re-review sees one finished set of contracts.

## What the Person Sees

1. **Merchant ownership takes a day to move.** When a merchant hands its account to a
   new wallet, the new wallet can accept only after 24 hours. Either side, or Strimz
   support, can stop it during that day. Someone who steals the owner's key can no
   longer lock the real owner out in a single minute.
2. **A new owner starts clean.** If the previous owner had started changing where
   payouts go, that change is cancelled the moment the new owner accepts. The seller of
   a merchant account cannot keep receiving the buyer's revenue.
3. **Strimz support can stop, never redirect.** Support can cancel a suspicious payout
   or ownership change. It cannot send money anywhere.
4. **An agent suspended by Strimz stays suspended.** Today it can switch itself back on.
5. **Pausing the agent escrow no longer freezes money already in it** (only if agent
   escrow is part of launch). New jobs stop; existing jobs can still finish, be
   refunded or be settled.
6. **A slow dispute does not hand finished work to the client for free** (only if
   agent escrow is part of launch). If nobody rules on a dispute within 30 days, the
   job ends the way it would have without the dispute: delivered work is paid, unfinished
   work is refunded.
7. **A customer's subscription signature works once.** It cannot be reused to sign them
   up again, and nobody can block their sign-up by racing their transaction.

## Important Limitation

The subscription contract cannot be changed in place, so the subscription fix only
applies on the new contract from the planned redeploy. Until the registry fix is live,
anyone transferring a merchant account must check the "pending payout change" box on
the dashboard and cancel it right after accepting. Merchant ownership transfers become
a one-day process; there is no fast path.

## What Changes

- Ownership transfers wait 24 hours, and the dashboard shows when the new owner can
  accept.
- Accepting ownership cancels any payout change the old owner started.
- Strimz operations gain a cancel-only button for suspicious merchant changes, and a
  written runbook for ownership transfers.
- Admin suspension of an AI agent cannot be undone by the agent.
- Agent escrow pause and dispute rules change, if agent escrow ships at launch.
- The subscription sign-up signature gains a one-time number. The SDK and checkout
  update with it.

## What Does Not Change

- Prices, fees, how and when subscriptions are charged.
- One-off payments and their contract.
- The 24 hour wait on payout address changes.
- Existing subscriptions on the current contract.
