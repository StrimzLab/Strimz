# ADR for Dummies: The checkout tells the shop how the payment went

- **Status:** Accepted (approved by the maintainer, 2026-10-16)
- **Date:** 2026-10-16

## The Idea

A shop can put the Strimz checkout on its own page, in a box or a pop-up window. Today
the checkout never tells the shop "paid" or "cancelled", so the shop's page just sits
there. We make the checkout send that message, to that shop only, and fix the pay button
code shops install.

## What the Person Sees

1. A customer clicks "Pay with Strimz" on a shop's site. The checkout opens in a pop-up
   (or inside the page).
2. They pay. The checkout shows "Payment complete" and tells the shop's page. The pop-up
   closes and the shop shows its own thank-you screen.
3. If they click Cancel, the shop is told, and the customer sees "Payment cancelled.
   Nothing was charged". Today Cancel dumps them on the Strimz homepage.
4. On a normal full-page checkout, Cancel goes to the shop's cancel page if the shop set
   one. The shop's thank-you link can now include the order's session id and transaction
   id, as our docs already promised.
5. A customer who connects a "smart" wallet like Safe is told right away that it can't
   pay here yet, instead of signing and then failing.

## Important Limitation

- Shops must update to the new pay-button package (0.3.0). Older versions still hear
  nothing, as today.
- Smart wallets still can't pay. Letting them pay needs a change to our payment contracts,
  which is filed separately for you to schedule.
- Cancel does not void the payment link. The customer (or anyone with the link) can still
  pay until it expires.

## What Changes

- The checkout page sends "success", "cancel" or "error" to the shop page that opened it.
- Cancel no longer goes to the Strimz homepage.
- Thank-you and cancel links fill in the session and transaction ids.
- The React pay button and embed get fixed and released as 0.3.0.
- Smart-wallet payers get a clear message before signing.
- Docs corrected where they promised things that don't happen.

## What Does Not Change

- How payments are signed, relayed and settled.
- The API, the database and the contracts.
- Webhooks stay the way shops should confirm a payment.
