# ADR (plain English): Take the fee from the start, refund the free part

- **Status:** Accepted 2026-11-21 by the founder
- **Date:** 2026-11-21

## What's the problem?

New merchants pay nothing on their first $1,000. Switching them to 0.5% at exactly the right moment can be gamed. Big payments can slip through while the switch happens, and a second account gets another free $1,000.

## What are we doing?

- **Every merchant pays the normal 0.5% fee from their first payment.** The contract takes it, like any other fee. There's no switch to game.
- **Strimz pays those fees back for each business's first $1,000** in each currency, to the merchant's payout wallet, within about 15 minutes.
- **One free $1,000 per business, not per account.** Accounts that share a payout wallet or owner wallet share it.
- **Refunds come from a small, separate refund wallet** that we top up from collected fees. If its key ever leaked, only that small balance is at risk.

## What does it change?

- **The fee can't be dodged any more,** and fake accounts gain nothing, because you only ever get back fees you actually paid.
- **New merchants see 0.5% taken, then refunded shortly after.** The dashboard and receipts show the refund.
- **Ops needs to keep the refund wallet topped up.** We get an alert when it runs low.
- **No contract change is needed.**
