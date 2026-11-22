# Launch with live mode only (plain English)

- **Status:** Accepted 2026-11-22 by the founder
- **Technical version:** [ADR-2026-11-22-live-only](ADR-2026-11-22-live-only.md)

## The change

We planned two copies of Strimz: a real one, and a practice one with fake money. Running the second copy costs too much right now, so we launch with the real one only.

## How merchants try it out

A merchant pays their own checkout a small amount, such as 1 USDC. The money lands in their own wallet. On the free plan our fee is refunded, and we pay the network fee. So trying Strimz costs them next to nothing, and they see exactly what their customers will see.

## What we'll tidy up

- **Dashboard:** no more "Test" badge, and no "Mode" choice when creating an API key.
- **Docs:** the "Test mode vs live mode" page becomes "Testing your integration". The examples use live keys, and the practice-network instructions come off the merchant pages.
- **Behind the scenes:** the code that separates practice from real stays. Our own practice network still uses it while we build, and it still blocks any stray practice key.

If merchants ask for a practice environment later, we can add one then.
