# ADR for Dummies: Make the pricing page true, and move merchants up plans automatically

- **Status:** Accepted (2026-10-14, D1–D7 as recommended; D6: keep only priority email support, on Starter and above)
- **Date:** 2026-10-14

## The Idea

The pricing page says Free 0%, Starter 0.5%, Growth 0.4% and Enterprise custom. The app
quietly runs an older price list:

- Free at 1.5%, plus plans with monthly fees;
- a 0.2% extra on subscriptions that is never actually charged.

Every merchant is charged 1.5% today. The page also lists a few features the app doesn't
have yet, such as custom domains.

We make the page the truth:

1. **One price list in the code** that matches the page. Every merchant starts on Free,
   at 0%.
2. **Automatic upgrades.** When a merchant's total processed volume (since sign-up)
   passes $1,000 they move to Starter; at $50,000 they move to Growth. They never move
   back down. We email them when it happens. Enterprise is agreed by contract.
3. **Plans unlock features.** The shop builder and the AI alerts and yield suggestions
   start at Starter. Free merchants see a note that these unlock automatically at $1,000.
4. **The page lists only what exists.** The sign-up buttons all go to the login page,
   except Enterprise, which goes to contact. Growth's button says "Start with Growth".
5. **A safety cap in the smart contract.** No merchant can ever be charged more than
   0.5%. Merchants also can't secretly set their own fee to 0% forever. That closes the
   loophole in #146.

## What the Person Sees

- **Merchants:** they start free, are upgraded automatically with an email, and see
  clearly which features unlock next.
- **The maintainer:**
  - decides which support and uptime promises stay on the page;
  - the contract change ships with the planned redeploy.

## Important Limitation

- Dollar (USDC) and euro (EURC) volume are counted separately, because our rules never
  add the two together. A merchant moves up when either reaches the threshold, so one
  that splits payments between both moves up a little later.
- The automatic upgrade uses a server key that can change merchant fees, but only
  between 0% and 0.5%, and it can be switched off instantly from the Safe.

## Choices for the maintainer

- **D1.** The plan table and thresholds above. Recommended.
- **D2.** Count all-time volume per currency; move up when either crosses. Recommended.
- **D3.** Check for upgrades every 5 minutes, then email the merchant. Recommended.
- **D4.** A 0.5% cap set at sign-up; merchants can't lower it; a narrow upgrade key for
  the server. Recommended.
- **D5.** The shop builder and the AI alerts start at Starter. Recommended.
- **D6.** Which support and uptime promises stay on the page. Your call.
- **D7.** The button changes as you asked. Recommended.
