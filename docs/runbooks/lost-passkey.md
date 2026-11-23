# Runbook: a merchant lost their passkey

A merchant's passkey signs them in and confirms withdrawals, refunds, payout changes, new API keys and webhooks (ADR-2026-11-22-passkey-step-up, ADR-2026-11-23-required-passkey).

## What still works

A lost passkey still counts as set up. The merchant can sign in with Google or an email code and use the dashboard. Only actions that need the passkey are blocked.

## Recovery

1. **Synced passkey.** Ask whether the passkey was saved to iCloud Keychain, Google Password Manager or another password manager. If it was, they sign in on a device with that account, and the passkey is there.
2. **Another passkey on the account.** Settings → Security lists every passkey. Any one of them can confirm actions, and can add a new one.
3. **No passkey left.** Strimz can't reset it. Privy's unlink API doesn't remove passkeys. Privy resets MFA only through support@privy.io, and only on Enterprise plans. Write to them with the Privy app ID and the merchant's Privy user ID (`did:privy:…`), and tell the merchant that nothing in the dashboard can move their funds until it's reset.

## Prevention

Tell merchants to use a synced passkey, and to add a second passkey on another device in Settings → Security.
