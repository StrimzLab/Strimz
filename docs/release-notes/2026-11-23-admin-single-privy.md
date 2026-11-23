---
date: 2026-11-23
feature: Admin sign-in works (one copy of Privy)
scope: fix
scenario-impact: none
---

# Admin sign-in works

Issue: #555.

Signing in to admin.strimz.finance either looped between `/admin` and `/admin/login`, which ended in Workers Error 1102, or stayed on "Checking admin access…". The admin app bundled two copies of `@privy-io/react-auth`:

- **The app's own copy signed the admin in.**
- **The shared admin API client asked the other copy for a token.** No provider was mounted for that copy, so it never gave one.
- **No token meant no request.** The API never received a single `/v1/admin/*` call.

pnpm made the second copy because `zod`, an optional peer of Privy, was a dependency of `packages/web-shared` and the dashboard but not of admin.

## What changed

- **One Privy copy.** Admin declares `zod`, which its bundle already used through the shared code. Admin now resolves the same Privy as the shared code.
- **The admin API client gets its token from the app's own Privy** (`usePrivy().getAccessToken`), so a future split can't cut it off.
- **No more loop.** When the API rejects a signed-in admin, the page says so and offers Sign out. It no longer sends them to a sign-in page that sends them straight back.
- **No hidden errors.** The token helper no longer swallows Privy's errors.
- **One fewer allowed origin.** Admin writes no longer accept the old `strimz-finance.vercel.app` origin.
- **New tests:**
  - every app that uses the shared code resolves the same copy of Privy, React Query, React, Next and sonner as the shared code;
  - the admin API client's token comes from the app's Privy;
  - the gate doesn't redirect a rejected signed-in admin;
  - the token helper passes Privy's errors on.

## Verified

- The admin production build has one Privy chunk; before, it had two.
- Each new test failed on `main` for the reason above.
- `./scripts/preflight.sh` passed in full.
- Sign-in itself was not tested here, because Privy's CAPTCHA blocks automated browsers. The founder checks it after deploy.
