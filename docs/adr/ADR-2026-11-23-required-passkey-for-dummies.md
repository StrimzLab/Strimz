# A passkey is a required sign-up step (plain English)

Issue #560. Technical version: ADR-2026-11-23-required-passkey.

## What went wrong

After onboarding a new account, the passkey page closed by itself and sent you to the dashboard. Your new account already had a passkey attached ("Passkey from Chrome" in Settings), but it wasn't set up to confirm withdrawals. The page saw a passkey and assumed you were done. It should only let you go once the passkey can confirm withdrawals, and nothing brought you back afterwards.

## What we'll do

Every new merchant goes through three steps, and the third can't be skipped:

1. Sign up
2. Onboarding
3. Add a passkey

- **No passkey yet:** you add one, and it's set up to confirm withdrawals in the same go.
- **A passkey already on the account:** one button sets it up for confirmations.
- **A browser that can't make passkeys:** the page says so and suggests a browser that can, or using your phone. There's no way around it.
- **Anyone who reaches the dashboard without one** (an older account, a bookmarked link) is sent to the passkey page first.
- **Settings won't let you remove your last passkey.**

## Why

Withdrawals and payout wallet changes already need your passkey. Without one, a merchant finds out only when they try to take their money out. Making it step 3 means everyone is ready from day one.

## The trade-off

If a merchant loses their only passkey (one not synced with iCloud or Google), they can still open the dashboard, but they can't withdraw or change their payout wallet. Privy can reset that only for apps on its Enterprise plan. This was already true before this change. Synced passkeys, and adding a second one, are the protection.
