# ADR for Dummies: Sign the approval amount when subscribing

- **Status:** Accepted 2026-10-28
- **Date:** 2026-10-28

## The Idea

To start a subscription, the payer signs two things:

- an approval that lets Strimz take the payment each period;
- a note naming the exact plan they picked.

The note doesn't say how big the approval is. Someone who copies the payer's signed note can use it with an approval of zero. The subscription is created but can never be charged, and the payer's real signup then fails.

We add the approval amount to the note, so the note only works with the approval the payer signed. We also refuse any subscription whose approval can't cover even one payment.

## What the Person Sees

1. Nothing new. The payer signs the same two prompts at checkout.
2. Their wallet now shows the approval amount in the second prompt as well.
3. A signup can no longer be broken by someone racing ahead with a copy of the signatures.

## Important Limitation

- **Redeploy needed:** the subscription contract can't be changed in place, so this takes effect with the testnet redeploy (#142).
- **Two steps:** this change updates the contract. The checkout and SDK sign the new note when the apps switch to the new contracts at #142. That switch is already planned for the other signature changes, so it's one switch, not two.
- **No money was ever at risk:** the problem broke signups. It couldn't move funds.

## What Changes

- **Contract:** the plan note includes the approval amount, and an approval smaller than one payment is refused.
- **At the #142 switch:** the SDK and checkout put the approval amount in the note. Merchants using the SDK update to the new version.

## What Does Not Change

- Charging, cancelling and one-off payments.
- Subscriptions created with a normal approval instead of a signed one.
- What the payer is charged or when.
