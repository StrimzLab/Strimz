# ADR for Dummies: Stop charging subscriptions in a token we've switched off

- **Status:** Accepted 2026-10-28
- **Date:** 2026-10-28

## The Idea

Strimz keeps a list of the tokens it accepts, such as USDC and EURC. If something goes wrong with a token, for example it loses its dollar value, we can take it off the list. That already stops new payments and new subscriptions in it.

But existing subscriptions in that token keep being charged every period, because the charging code never looks at the list. We make the charging code check the list too. While a token is off the list, its subscriptions are skipped, not charged. If the token comes back, charging picks up again without billing for the time it was off.

## What the Person Sees

1. **Payer:** while the token is switched off, they aren't charged. When it's back, they're charged for the current period only, never for the gap.
2. **Merchant:** after the apps update at the redeploy, the dashboard shows these charges as skipped because the token isn't accepted. It doesn't show them as failed payments, and the payer isn't marked at risk.
3. **Strimz team:** taking a token off the list is now a real emergency stop for recurring billing in that token. Before, the only stop was pausing every subscription in every token.

## Important Limitation

- **Redeploy needed:** the subscription contract can't be changed in place, so this takes effect with the testnet redeploy (#142).
- **Subscriptions stay open:** a token that is removed for good leaves its subscriptions open and never charged. We don't cancel them automatically, because a removal may only last a few hours. What to do with them is decided at the time.
- **A little more gas:** each charge does one extra check, which Strimz pays for.

## What Changes

- **Contract:** before charging, it checks that the subscription's token is still on the list. If it isn't, the charge is skipped with a new reason, "token not allowed".
- **At the redeploy:** the database, indexer, shared types and scheduler learn the new reason, and the scheduler stops proposing those subscriptions.

## What Does Not Change

- One-off payments. They already check the list.
- Charges in tokens that are still on the list.
- How missed periods work. Strimz never back-bills a payer for a period it skipped.
