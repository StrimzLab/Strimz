# ADR for Dummies: The first Strimz admin is created on purpose, not by whoever owns an email

- **Status:** Accepted 2026-10-03
- **Date:** 2026-10-03

## The Idea

Strimz has an internal admin area with a top role, super admin, that can add and remove
other admins. Today a database setup script writes in one personal email address as
super admin, and whoever first signs in with that email takes the role. That happens on
every copy of the database, everywhere. We stop handing out admin roles based on an
email address alone. The first super admin is created once, on purpose, by someone with
access to the server, and later admins accept an invite link that expires.

## What the Person Sees

1. A new Strimz environment starts with no admins.
2. The operator signs in to Strimz once so Privy (our login provider) knows them, and
   copies their Privy user id from the Privy dashboard.
3. On the server, the operator runs one command with that id. Strimz checks the id with
   Privy, creates the super admin, and records it in the audit log. The command refuses
   to run again once a super admin exists.
4. The operator opens the admin area and is in.
5. To add a colleague, the super admin sends an invite. The colleague gets an email with
   a link that works once, for 7 days, and only for the person signed in with the
   invited email.
6. Signing in with an invited or seeded email, without the link, gets "no admin profile
   for this account".

## Important Limitation

The personal email already in the old setup script stays in the project's history; that
file cannot be changed. If someone already used the old seeded entry in production, it
is kept so nobody is locked out, and the maintainer should check who that is.

## What Changes

- The old seeded super admin is removed from any database where nobody used it.
- Signing in never makes anyone an admin because of their email.
- A one-time server command creates the first super admin.
- Admin invites become links that expire and can be re-sent.
- Invites sent before this change must be re-sent.
- The server runbook gets a "First admin" section.

## What Does Not Change

- The admin roles and what each one can do.
- Merchant sign-in and the merchant dashboard.
- Any admin who is already set up and signing in today.
- Payments, subscriptions, contracts, webhooks and the SDK.
