---
date: 2026-10-16
feature: Login and signup wait for Privy before moving on, the merchant dashboard checks the session, and sign-in returns to the page you wanted
scope: fix
scenario-impact: none
---

# Login bounce, dashboard guard and `next`

Fixes #148. ADR: [ADR-2026-10-16-auth-login-flow](../adr/ADR-2026-10-16-auth-login-flow.md)
([plain-English version](../adr/ADR-2026-10-16-auth-login-flow-for-dummies.md)), D1 to D3
accepted.

## What shipped

- **Login and signup** use Privy's `useLogin`, in one shared `PrivyContinueButton`.
  - They move to `/callback` only from `onComplete`, so the first click no longer bounces
    back to `/login`. `privy.login()` returns as soon as the modal opens.
  - Closing the modal (`exited_auth_flow`) shows nothing; other login errors show a toast.
  - An already signed-in visitor is forwarded at once.
  - Without `NEXT_PUBLIC_PRIVY_APP_ID`, the button keeps its "Authentication not
    configured" toast.
- **The merchant dashboard checks the session.** `dashboardGate` decides:
  - Privy or the merchant still loading: spinner;
  - signed out, or a session the API rejects: `/login?next=<page>`;
  - `merchant_not_synced`: `/callback?next=<page>`;
  - onboarding not finished: `/onboarding`;
  - any other error: a message with a retry button.

  The merchant request waits for a Privy session.

- **`next`:**
  - login, signup and the callback carry it, and after sync the callback goes there;
  - this covers the admin shell's `/login?next=` redirect;
  - `safeNextPath` accepts same-site paths only.

## Operator steps

None. **After the web deploys:**

- log in and sign up once each;
- open `/app/invoices` while signed out and check you return there after login;
- close the login modal once and check no error appears.

## Verification

- **Red, then green:**
  - `auth-redirect.test.ts` (23 tests): the module did not exist.
  - `auth-login-flow.test.ts`: 5 failed.
- **Changed test:** `signup-bot-check.test.ts` now looks for `<PrivyContinueButton`
  instead of `privy.login()`. It still checks that there is no separate verify call.
- **Results:**
  - web: 361 of 361;
  - `./scripts/preflight.sh` in full.
