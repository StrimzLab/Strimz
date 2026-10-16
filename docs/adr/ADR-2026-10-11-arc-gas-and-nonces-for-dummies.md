# ADR for Dummies: Don't let busy network days freeze payments

- **Status:** Accepted (2026-10-11, G1–G6 as recommended)
- **Date:** 2026-10-11

## The Idea

Every blockchain transaction carries a fee offer. When Arc is busy, the minimum fee
rises, up to a documented maximum. If our offer is below the current minimum, the
transaction just waits and never goes through.

Two things are wrong today:

1. The service that pays fees for customer payments never offers more than 200 units,
   but Arc's fee can reach 20,000. On a busy day every payment would wait, and the ones
   behind it would queue up, until the network calmed down. And if reading the current
   fee fails, it quietly offers the cheapest fee instead of reporting the problem.
2. The service that charges subscriptions can send two transactions at the same moment
   with the same sequence number, so one fails. It also signs for whichever network its
   connection claims to be, instead of the one it is configured for.

We change it so that:

1. The payment service always offers enough to get in, up to Arc's maximum, and stops
   with a clear error if the network reports something impossible.
2. A failed fee lookup is reported and retried, not hidden.
3. The subscription service numbers its own transactions in order and signs only for the
   configured network.

## What the Person Sees

- Merchants and payers: payments keep going through on busy days.
- The maintainer: nothing to configure. A merchant registration costs about 0.002 USDC
  in gas today. Even at Arc's absolute fee ceiling it would cost about 1.7 USDC, and
  the existing per-merchant gas budget still tracks it. To send at that ceiling, the
  relayer wallet needs to hold a little more (about 12 USDC) than one transaction costs.

## Important Limitation

If Arc raises its maximum fee for mainnet, the payment service refuses until we update
the number, by design. Running a second copy of the subscription service would need a
shared numbering store; today there is one.

## Choices for the maintainer

- **G1.** No 200 cap; refuse readings above Arc's maximum. Recommended.
- **G2.** Keep the 20 minimum both networks show today. Recommended.
- **G3.** Report and retry a failed fee lookup. Recommended.
- **G4.** Number scheduler transactions in order inside the process. Recommended.
- **G5.** Sign scheduler transactions only for the configured network. Recommended.
- **G6.** Leave the scheduler's fee estimate as is. Recommended.
