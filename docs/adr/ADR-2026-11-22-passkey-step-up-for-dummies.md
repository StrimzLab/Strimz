# A passkey guards every sensitive action (plain English)

- **Status:** Accepted 2026-11-22 by the founder
- **Technical version:** [ADR-2026-11-22-passkey-step-up](ADR-2026-11-22-passkey-step-up.md)

## The problem

To create an API key, a merchant must have "two-factor" switched on, but Strimz has no way to switch it on. With live mode only, nobody could create a key.

## The fix: the passkey is the second factor

A passkey is the fingerprint, face or PIN on the merchant's own device. When a merchant adds one, it also becomes their second factor, so there's nothing else to set up.

From then on, the dashboard asks for the passkey whenever something sensitive happens:

- **Creating or replacing an API key.**
- **Adding or changing a webhook** (where Strimz sends payment notifications).
- **Withdrawing money.**
- **Changing the payout wallet.** It starts as the wallet Strimz creates for them, and changing it still takes 24 hours.

## Why this can't be skipped

- **Money actions** (withdrawals, payout changes) are signed by the merchant's wallet, which Privy holds. We turn on a Privy setting so the wallet refuses to sign until the passkey is used.
- **Key and webhook actions** happen on our server. Our server asks Privy to check the passkey, and only then allows the action. Someone who skips the dashboard and calls our server directly is still refused.

So someone who steals a merchant's login still can't create keys, redirect webhooks, withdraw or change the payout wallet without the merchant's own device.

## What merchants notice

They add a passkey once, and confirm with it on sensitive actions. Merchants can add more than one passkey, for example a phone and a laptop, in case one is lost.
