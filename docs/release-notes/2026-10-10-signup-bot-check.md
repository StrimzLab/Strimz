---
date: 2026-10-10
feature: Signup's bot check moves into Privy's login CAPTCHA; the cosmetic Strimz Turnstile check is removed
scope: fix
scenario-impact: needs_automation
---

# Public endpoint hardening, part 4: signup bot check

The signup page ran a Cloudflare Turnstile widget and verified its token against the web
app's own route before opening Privy. Nothing on the server depended on that check: the
login page opened Privy with no check at all, a new email that logged in there got a
merchant from `POST /v1/auth/sync`, and the web route passed every token when its
secret was unset. The API also had a `POST /v1/auth/turnstile/verify` that no client
called.

Part 4 of 5 for #133. ADR:
[ADR-2026-10-10-public-endpoint-hardening](../adr/ADR-2026-10-10-public-endpoint-hardening.md)
([plain-English version](../adr/ADR-2026-10-10-public-endpoint-hardening-for-dummies.md)),
decision 4 (D6). Earlier parts:
[2026-10-10-public-endpoint-hardening](./2026-10-10-public-endpoint-hardening.md),
[2026-10-10-payer-binding](./2026-10-10-payer-binding.md) and
[2026-10-10-contact-hardening](./2026-10-10-contact-hardening.md).

## What shipped

- Privy's login CAPTCHA (Cloudflare Turnstile), enabled in the Privy dashboard, now
  checks every login attempt: the signup page, the login page and scripted logins.
- The signup page no longer renders its own Turnstile widget; "Continue" opens Privy
  directly, like the login page.
- Removed the web route `POST /api/auth/turnstile/verify`.
- Removed the API route `POST /v1/auth/turnstile/verify` and
  `AuthService.verifyTurnstile`. The API's Turnstile adapter stays for the contact form.
- The web CSP already allows `https://challenges.cloudflare.com` in `script-src` and
  `frame-src` on every route, which is what Privy's CSP guide asks for with Turnstile.

## API behaviour change

| Route                            | New answer              |
| -------------------------------- | ----------------------- |
| `POST /v1/auth/turnstile/verify` | `404` (was `200`/`403`) |

No client called this route.

## Deploy

1. Privy dashboard: enable CAPTCHA with Cloudflare Turnstile for the production app
   (App settings, Advanced) **before** this PR merges. Once the web part is live the
   signup page has no bot check of its own.
2. The web part goes live on merge (Vercel). `TURNSTILE_SECRET_KEY` on Vercel is no
   longer read by the web app and can be removed. Keep
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: the contact form uses it.
3. The API part reaches production at the maintainer's manual Lightsail redeploy. No
   migration, no new env var.

## Scenario impact

`needs_automation`: covered by an API e2e test (`signup-bot-check.e2e.test.ts`) and a web
unit test (`signup-bot-check.test.ts`). Privy's CAPTCHA is dashboard configuration and is
checked by hand: in light and dark mode, sign up and log in with a new email and see
Privy's invisible challenge pass; a scripted `privy.login` without the challenge fails.
