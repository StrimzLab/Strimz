# ADR for Dummies: Nobody can jam a checkout, and Try again is safe

- **Status:** Accepted 2026-10-03
- **Date:** 2026-10-03

## The Idea

When a customer pays on a Strimz checkout page, their payment gets a tracking label.
Today that label is something anyone can guess, like the checkout's own web address. A
prankster can send a fake payment with that label first, and for an hour the real
customer only ever sees the prankster's failure. The same thing makes the Try again
button useless. We make Strimz create the label itself from the customer's own
signature, so nobody else can produce it, and we make sure that trying again can never
take the customer's money twice.

## What the Person Sees

1. A customer opens a checkout link and signs the payment in their wallet.
2. Someone who saw the link sends a fake payment for the same checkout. Today that
   blocks the customer for an hour. After this change Strimz checks the fake against the
   blockchain before doing anything, sees it would fail, and throws it away. The
   customer is not affected.
3. If the customer's payment fails for a real reason, such as a network hiccup, they
   press Try again and sign again. Today they get the old failure back. After this
   change Strimz sends the new signature.
4. Every signature a wallet makes for one checkout carries the same one-time serial
   number. The stablecoin itself accepts that serial number once, so even if an old
   attempt and a new one both reached the blockchain, only one could take money.
5. If an earlier attempt might still go through, Strimz asks the customer to wait (at
   most about five minutes) instead of sending a second one.

## Important Limitation

If a customer pays one checkout from one wallet, and then from a completely different
wallet at the exact moment the first payment is stuck in the network, Strimz relies on
its own records to refuse the second. The blockchain itself does not stop two different
wallets paying the same checkout. Closing that last gap needs a smart contract change,
which is a separate decision.

## What Changes

- Strimz, not the browser, creates the tracking label for each payment attempt.
- Fake or broken payment attempts are rejected before they cost Strimz any gas.
- Try again on the payment and subscription checkout pages works.
- A checkout's payment status can only be read by that checkout, not by anyone holding
  a label.
- Developers who call the payment relay directly must use the label Strimz returns,
  not one they made up. The API docs and release notes say so.

## What Does Not Change

- The smart contracts, the database, webhooks and the published `@strimz/sdk`.
- What the customer signs, apart from the serial number now being fixed per checkout.
- A payment that already succeeded is still shown as paid, never charged again.
