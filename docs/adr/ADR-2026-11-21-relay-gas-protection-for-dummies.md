# ADR (plain English): Stop gas being drained without hurting honest merchants

- **Status:** Accepted 2026-11-21 by the founder
- **Date:** 2026-11-21

## What's the problem?

Strimz pays the small network fee for every payment, signup and cancel. Someone could try to make Strimz pay thousands of fees for nothing:

- by creating many fake merchants;
- by signing up fake customers to a real merchant until that merchant's daily allowance runs out;
- by using wallets that fail on purpose.

Today, a merchant whose allowance runs out stops taking payments until midnight UTC. That's the part we must not allow.

## What are we doing?

- **The checkout always works.** If Strimz decides not to pay the fee, the customer is asked to pay it themselves, from the same wallet. It's a small fee in USDC, and the page shows the live amount for the network it's on. We measure the real costs on testnet now, and again on mainnet before launch. They don't have to approve anything again.
- **A daily limit for the whole platform, and a minimum balance for the fee wallet.** If either is reached, Strimz stops paying fees and tells ops, and customers pay their own fee until it's fixed.
- **New free merchants start with 50 free fees a day.** The full 500 unlock after their first real payment. Admins can unlock it sooner.
- **Bot protection at sign-in,** switched on in Privy's settings.
- **Limits on each customer wallet and each internet address,** so one person can't use up a merchant's allowance. Those limits never touch the merchant.
- **Two deliberate failures in a day,** and that wallet pays its own fees for the next 24 hours.

## What does it change?

- **Honest merchants never lose a sale because of these limits.**
- **Attackers end up paying for their own attacks.**
- **During an attack, some customers see a small fee prompt.**
