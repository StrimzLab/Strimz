---
date: 2026-11-23
feature: A passkey is a required sign-up step
scope: feature
scenario-impact: none
---

# A passkey is a required sign-up step

Issue: #560. ADR: ADR-2026-11-23-required-passkey.

Every merchant now goes through three steps: sign up, onboarding, then a passkey. The passkey step can't be skipped, and it counts as done only once the passkey can confirm withdrawals and payout changes.

## The bug it fixes

A merchant whose account already had a passkey linked was sent straight past the passkey step. That happened when they signed up in a browser that held a Strimz passkey from another account. The passkey could sign them in but not confirm anything, and nothing brought them back to finish.

## What changed

- **The passkey page:**
  - with no passkey on the account, it shows **Add a passkey**;
  - with a passkey that can't confirm yet, it shows **Use my passkey for confirmations**;
  - in a browser that can't make passkeys, it says so;
  - **Sign out** is always there. There is no skip.
- **Sign-in:** a merchant without a confirming passkey is always sent to the passkey page. The weekly offer, and its `strimz:passkey-offered-at` browser storage, are gone. The privacy policy no longer lists that storage.
- **Dashboard:** every dashboard page sends a merchant without a confirming passkey to the passkey page first. This covers existing accounts and bookmarked links.
- **Settings:** the last passkey that confirms actions can't be removed; add another one first.
- After setup, the dashboard refreshes the merchant's Privy profile, so it doesn't send them back to the passkey page.
- **Runbook:** `docs/runbooks/lost-passkey.md`. Privy resets MFA only through its support, on Enterprise plans.

## Rollout

Deploy the dashboard. There is no API, schema or contract change. Existing merchants without a confirming passkey see the passkey page on their next visit.

## Verified

- Tests:
  - the dashboard gate;
  - the passkey page, which no longer leaves for a linked passkey that can't confirm (red before the fix);
  - the sign-in routing;
  - removing passkeys in Settings.
- `./scripts/preflight.sh` passed in full.
- **Not yet checked live:** the passkey prompts need a real device and a Privy sign-in. The founder checks this on mainnet after deploy.
