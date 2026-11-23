---
date: 2026-11-23
feature: Sign-up fixes (Strimz wallet, Google return) and agent escrow docs
scope: fix
scenario-impact: updated
---

# Sign-up fixes and agent escrow docs

Issues: #543, #542, #541. All three were found during the first mainnet sign-up.

## New merchants get their Strimz wallet (#543)

Since the custom sign-in screens (#524), new merchants had no Strimz wallet. Onboarding showed "Setting up your Strimz wallet…" forever. Privy only creates the wallet itself for logins through its own modal, and the dashboard signs in headlessly.

- After sign-in, the dashboard creates the Privy embedded wallet if the person has none, before the first `/v1/auth/sync`. An existing wallet is never touched.
- Onboarding repairs accounts that signed up without a wallet: it creates one, syncs again and reloads the merchant. A failure shows **Try again** instead of waiting forever.

## Google sign-up finishes on the first try (#542)

- **What happened:** after Google returned, Privy signed the person in, but the page stayed on `/signup` with no message. A second click was needed.
- **Why:** Privy clears its OAuth parameters from the URL with `history.replaceState`. Next.js took that as a navigation back to `/signup`, which cancelled the client-side move to `/callback`.
- **Fix:** the move to `/callback` is now a full navigation, which that clean-up can't cancel.

## Agent escrow is "coming soon" in the docs (#541)

- The architecture page and the glossary no longer describe the agent escrow as deployed.
- The indexer and scheduler setup pages mark the agent addresses optional, to be left unset on mainnet.

## Verified

- **Unit tests:**
  - the wallet is created when missing, never when one exists, and before the sync;
  - onboarding repairs the account and offers a retry;
  - the post-sign-in move is a full navigation.
- **`./scripts/preflight.sh`:** passed in full.
- **On mainnet after deploy:** the first merchant, stuck since sign-up, completes onboarding.
