# Fixing the "Verify you are human" loop (plain English)

- **Status:** Accepted 2026-11-28 by the founder
- **Date:** 2026-11-28
- **Technical version:** ADR-2026-11-28-signup-turnstile-loop

## What's wrong

On the "Create your Strimz account" page, the "Verify you are human" box spins and comes back empty, again and again. A recent change asked for a second check straight after the first, and that second request kept wiping out the first. Nobody could create an account.

## What we'll do

- The sign-up page asks once, and keeps the result.
- A new user's test account asks for its own check, on the "Setting up your test account" screen, only if it needs one.
- The sign-up and login pages, and the website's "Sign in" and "Start free" buttons, stay as they are.

## What changes for people

Sign-up works again. A new user may be asked to confirm they're human one more time while their test account is set up, on its own screen.
