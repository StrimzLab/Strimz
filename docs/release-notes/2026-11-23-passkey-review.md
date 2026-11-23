---
date: 2026-11-23
feature: Passkey review - confirmations reach the API, one prompt, refunds gated, fresh eligibility
scope: fix
scenario-impact: updated
---

# Passkey review

Issue: #551. This is a full review of every passkey path after the first mainnet merchant couldn't issue an API key. It covers sign-in, sign-up, the onboarding offer, Settings, step-up (API keys and webhooks), wallet MFA (withdraw, payout and owner, refunds) and eligibility.

## Fixed

- **Confirmed requests reach the API.** `x-strimz-step-up` is now in the allow-list for dashboard origins. Before, the browser blocked `POST /v1/api-keys` and the webhook writes after a successful passkey confirmation, with "Failed to fetch". A new test checks that every `x-strimz-*` header the dashboard's API client sends is allowed.
- **One passkey prompt.** `PrivyProvider` sets `mfa.noPromptOnMfaRequired`, so Privy's own MFA screen no longer races ours for the same challenge.
- **The prompt can be cancelled** at any time. An answer that arrives after cancelling is ignored. A failure shows a reason and **Try again**.
- **Refunds need the passkey,** like withdrawals. Without one, the dashboard says so and links to Settings. A test lists every file that uses the embedded wallet and checks each one is gated, so Privy is never left waiting for an enrolment that nothing answers.
- **Google sign-ins count as a verified email.** They were stored as unverified, so live-mode eligibility refused every Google merchant.
- **Eligibility asks Privy before refusing.** If the stored email or two-factor flag is off, the API checks Privy and keeps the answer. The dashboard also syncs straight after enrolling a passkey, since Privy sends no webhook for enrolment.
- **Settings:**
  - explains that adding or removing a passkey asks for one you already have, so a stolen login can't remove it;
  - asks before removing the last passkey that confirms actions;
  - the post-onboarding passkey page also mounts the prompt.

## Docs

`authentication.mdx` and `errors.mdx`:

- add refunds and passkey changes to the confirmed actions;
- describe the single prompt;
- point to Settings, Business, Security.

## Verified

- Every fix has a test that failed first:
  - `cors-dashboard-headers.test.ts`;
  - `privy-mfa.test.ts`;
  - `passkey-mfa-wiring.test.ts`;
  - the eligibility e2e test.
- API e2e: 515 tests in 63 files pass.
- Dashboard: 167 tests pass.
- `./scripts/preflight.sh` passed in full.
