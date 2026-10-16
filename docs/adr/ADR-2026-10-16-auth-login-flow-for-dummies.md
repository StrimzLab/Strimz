# ADR for Dummies: Fix the login bounce and protect the dashboard

- **Status:** Accepted (2026-10-16, D1 to D3 as recommended)
- **Date:** 2026-10-16

## The Idea

- **The bounce.** When you click "Continue" on the login or signup page, the page jumps to the
  next step before you have finished logging in. That step sees you are not logged in yet and
  sends you back to the login page.
- **The fix.** Wait for the login provider (Privy) to say "done", then move on. That is how
  Privy says to do it.

While there:

- **The dashboard checks you are signed in.**
  - If not, it sends you to log in, then brings you back to the page you wanted.
  - If your account still needs setting up, it finishes that first.
  - If something else breaks, you see a clear message with a retry button instead of an
    empty dashboard.
- **The "bring you back" link is checked** so it can only point inside Strimz, never to
  another site.

## What the Person Sees

- **Merchants:** login and signup work on the first click. Closing the login window does not
  show an error.
- **Admins:** after signing in, they return to the admin page they were on.

## Choices for the maintainer

- **D1.** Wait for Privy before moving on. Recommended.
- **D2.** Protect the dashboard as described. Recommended.
- **D3.** Bring people back to the page they wanted, inside Strimz only. Recommended.
