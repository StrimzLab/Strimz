---
date: 2026-11-21
feature: Our own sign-up and login screens, with passkeys and server-checked Turnstile
scope: feature
scenario-impact: updated
---

# Sign-up and login, rebuilt

ADR: [ADR-2026-11-21-custom-auth-screens](../adr/ADR-2026-11-21-custom-auth-screens.md). UI: #523.

## For merchants

- **New sign-up and login screens:** Continue with Google, or email plus a 6-digit code. Login also offers Sign in with a passkey. There's no wallet sign-in any more.
- **Passkeys:**
  - After setup, merchants are offered "Add a passkey". It's skippable, and offered again at most once a week to merchants who don't have one.
  - Settings → Security lists passkeys and lets you add or remove them. You can't remove your last way in.
- **Nobody loses access.** Strimz has always required an email, so every existing merchant can sign in with an email code, or with Google if that's how they signed up.

## For operators

- **New accounts need a passed bot check.**
  - `POST /v1/auth/sync` creates a merchant only with a Turnstile token that the API verifies with `TURNSTILE_SECRET_KEY` (action `signup`, hostname of `STRIMZ_DASHBOARD_URL`).
  - Without one it answers `428 turnstile_required`.
  - Existing merchants never need a token.
- **Privy's invisible CAPTCHA (Turnstile) is on** in the Privy dashboard and rendered beside our forms.
- **The Privy webhook now works and no longer creates accounts.**
  - It read `data.user`, but Privy sends `user` at the top level, so it had been ignoring every event.
  - It now refreshes existing merchants only, and records passkey adds and removals in the audit log (`passkey.added` and `passkey.removed`).
- **Privy upgrade:** `@privy-io/react-auth` goes from 1.97 to 3.51.3 in the dashboard, the admin console and web-shared. The admin console keeps Privy's modal, without wallet sign-in.
- **The dashboard build needs `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.** The Turnstile widget's hostnames must include `app.strimz.finance`.

## Tests

- **API:**
  - `auth.e2e` covers the Turnstile gate: no token, a bad token, a token from another form, existing merchants, and the webhook.
  - `privy-webhook.e2e` uses signed, real-shape payloads.
  - Turnstile hostname unit tests.
- **Dashboard:** `auth-flow.test.ts` (error copy, code input, signup token, widget size) and `passkeys.test.ts`.
- **web-shared:** sign-in source checks are updated to the new screens.
