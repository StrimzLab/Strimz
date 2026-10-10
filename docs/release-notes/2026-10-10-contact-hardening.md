---
date: 2026-10-10
feature: The contact form needs a Turnstile pass, and a failed send is reported instead of acknowledged
scope: fix
scenario-impact: needs_automation
---

# Public endpoint hardening, part 3: contact form

`POST /v1/contact` sends one email to the Strimz support inbox for every accepted
request. Before this change any script could call it with no bot check, and a Resend
failure still answered `{ ok: true }`, so the sender believed a message had arrived that
nobody would see.

Part 3 of 5 for #133. ADR:
[ADR-2026-10-10-public-endpoint-hardening](../adr/ADR-2026-10-10-public-endpoint-hardening.md)
([plain-English version](../adr/ADR-2026-10-10-public-endpoint-hardening-for-dummies.md)),
decision 5 (D7). Earlier parts:
[2026-10-10-public-endpoint-hardening](./2026-10-10-public-endpoint-hardening.md) and
[2026-10-10-payer-binding](./2026-10-10-payer-binding.md).

## What was wrong

- `POST /v1/contact` had no bot check; part 1 added only the 5-an-hour per-address limit.
  Rotating addresses could still fill the support inbox at Resend's cost.
- `contactRequestInputSchema` had no token field, so the form could not send one.
- A Resend failure was logged and the caller got `{ ok: true }`.
- `TurnstileService` passed every token when `TURNSTILE_SECRET_KEY` was unset, in
  production too, with only a boot warning.

## What shipped

- `@strimz/shared-types` (minor): `contactRequestInputSchema` gains an optional
  `turnstileToken`. It is optional in the type so existing callers compile; the API
  requires a passing token.
- The API verifies the token with `TurnstileService.verify(token, clientIp, 'contact')`
  before anything is sent. A missing, refused or wrong-action token answers
  `403 bot_check_failed` and sends no email.
- A Resend failure answers `502 email_unavailable`.
- `TurnstileService` throws at construction when `NODE_ENV=production` and
  `TURNSTILE_SECRET_KEY` is unset, so the API refuses to boot instead of running with the
  check off. In development and test it still starts without a secret and passes every
  token, as before.
- The marketing contact form renders the Cloudflare Turnstile widget with
  `action: 'contact'` (it follows the light/dark theme), sends the token, and shows the
  `403`, `502` and `429` answers inline and in a toast. A token is single use, so the
  widget resets after every attempt. Its labels now read `(required) *` or `(optional)`.
- When `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset (local development) the form shows no
  widget and sends no token.

## API behaviour change

| Route              | New answer                                                           |
| ------------------ | -------------------------------------------------------------------- |
| `POST /v1/contact` | `403 bot_check_failed` when `turnstileToken` is missing or refused   |
| `POST /v1/contact` | `502 email_unavailable` when the email provider fails (was `201 ok`) |

## Deploy

Order matters: the web form must send `turnstileToken` before the API requires it.

1. Cloudflare: make sure a Turnstile widget covers the marketing hostnames that serve
   `/contact` (`strimz.finance`, `www.strimz.finance` if used, and any Vercel preview
   hostname you test on). Reuse the signup widget if its hostname list covers them;
   otherwise create one and use its keys below.
2. Vercel: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` before this PR merges. The web part goes
   live on merge. The API on Lightsail today strips the unknown `turnstileToken` key, so
   the form keeps working against it.
3. Lightsail: put `TURNSTILE_SECRET_KEY` (the secret of the same widget) in the env file
   **before** the redeploy. Without it the API does not start.
4. The API part reaches production only at the maintainer's manual Lightsail redeploy,
   after the web deploy. No migration.

## Scenario impact

`needs_automation`: covered by API e2e tests (`contact-hardening.e2e.test.ts`), a unit
test for the production boot check (`turnstile-config.test.ts`) and web unit tests
(`contact-submission.test.ts`, `contact-form.test.ts`); `docs/scenarios/` has no scenario
to update. After the redeploy: send the contact form in light and dark mode and confirm
the message arrives; a `curl` without a token answers `403 bot_check_failed`.
