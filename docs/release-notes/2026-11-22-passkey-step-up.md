---
date: 2026-11-22
feature: A passkey is the second factor and confirms every sensitive action
scope: feature
scenario-impact: updated
---

# Passkey confirmation for sensitive actions

ADR: [ADR-2026-11-22-passkey-step-up](../adr/ADR-2026-11-22-passkey-step-up.md).

## For merchants

- **A passkey is your second factor.** Adding one (during setup, from the weekly offer, or in Settings, Security) also sets it up for confirmations. Passkeys added earlier get a one-tap "Use my passkey for confirmations".
- **The dashboard asks for your passkey before you:**
  - create or rotate an API key;
  - add a webhook endpoint or rotate its secret;
  - withdraw;
  - change your payout wallet or owner.
- **Withdraw and the on-chain policy settings** ask you to add a passkey first if you don't have one.
- **Creating a key needs a passkey.** Without one, key creation is refused, so add a passkey before your first key.

## For operators

- **Privy Transaction MFA is on, with passkey as the only method and a 15-minute window.** Privy pauses every embedded-wallet signature until the passkey is used, and the dashboard shows its own "Confirm with your passkey" dialog.
- **New dashboard-session routes:**
  - `POST /v1/auth/step-up/start` and `POST /v1/auth/step-up/verify`, which use Privy's server-side passkey MFA;
  - each verification issues a one-use token that is valid for 5 minutes, bound to the merchant and to one action, and stored only as a hash in Redis.
- **Guarded routes** need the token in `x-strimz-step-up`, or answer `403 step_up_required`:
  - `POST /v1/api-keys`;
  - `POST /v1/api-keys/:id/rotate`;
  - `POST /v1/webhook-endpoints`;
  - `POST /v1/webhook-endpoints/:id/rotate-secret`.
- **API keys are never asked.** Requests made with an API key skip the passkey check.
- **A successful verification also records `twoFactorEnabled`.** A merchant who just added a passkey is eligible for keys without signing in again.

## Tests

- **API, `passkey-step-up.e2e`:**
  - a key or webhook change without a confirmation is refused;
  - confirm, then create, then the token is used up;
  - the challenge is issued for the dashboard origin;
  - a token for another action or another merchant is refused;
  - a failed passkey is refused;
  - an account with no passkey gets `passkey_required`;
  - API keys are exempt;
  - a fresh passkey satisfies eligibility.
- **Updated:** the eligibility, route-access and SDK-parity tests.
- **web-shared:** `webauthn` covers Privy's options in either naming style, base64url, and the shape of the assertion.

Not verified yet: the passkey prompt against Privy's live API. That needs the dashboard on its real domain.
