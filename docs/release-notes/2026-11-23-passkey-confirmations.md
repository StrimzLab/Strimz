---
date: 2026-11-23
feature: Passkey confirmations work, the passkey step and link are fixed, and signer mismatches are named
scope: fix
scenario-impact: updated
---

# Passkey confirmations and related fixes

Issues: #548, #546, #547, #545. All four were found during the first mainnet onboarding.

## Passkey confirmation always said "add a passkey" (#548)

The API looked for `mfaMethods` on the Privy user, and `@privy-io/server-auth`'s `getUser()` never returns it. Every passkey step-up (API keys, webhooks, withdrawals, payout changes) was refused with `passkey_required`, even with a passkey enrolled.

- `PrivyService.hasPasskeyMfa` and `hasMfa` now read the passkey account's `enrolledInMfa`, which is where the SDK puts it.
- The API's test stub copied the same mistake, so the e2e tests passed. It now returns the SDK's shape and uses the real check.

## Onboarding skipped the passkey step (#546)

The page's "already onboarded, go to `/app`" guard fired on the merchant's own submit and beat the move to `/passkey`. It now only applies before a submit.

## "Add a passkey in Settings" did nothing (#547)

It linked to `#security` on the Business tab while the person was on another tab. It now links to `/app/settings?tab=security`, which opens the Business tab and scrolls to the passkey settings.

## Signer mismatches say what differed (#545)

When Privy's signed transaction doesn't match the request, the error now names each differing field with both values, or the wrong signer. Nothing is broadcast, as before.

## Verified

- Each fix has a test that failed before it:
  - `privy-mfa.test.ts`;
  - `passkey-routes.test.ts`;
  - two new cases in `privy-server-signer.test.ts`.
- `./scripts/preflight.sh` passed in full.
- To do on mainnet after deploy: the first merchant issues a publishable key with their passkey.
