---
date: 2026-10-03
feature: Admin roles are granted to a Privy account by a server command or an accepted invite, never by email alone
scope: fix
scenario-impact: needs_automation
---

# Admin bootstrap: no admin role by email claim

The first `super_admin` is now created by a command run on the server, and every later
admin accepts a one-time invite link. Signing in with an email that matches an admin row
no longer grants that row's role. The migration that removes the seeded `super_admin`
row only removes it if nobody ever claimed it.

Closes #135. ADR: [ADR-2026-10-03-admin-bootstrap](../adr/ADR-2026-10-03-admin-bootstrap.md)
([plain-English version](../adr/ADR-2026-10-03-admin-bootstrap-for-dummies.md)).
Runbook: [admin-bootstrap](../runbooks/admin-bootstrap.md).

## Before merge: check production

The maintainer must run this on the production server before this change is merged:

```bash
docker exec -it strimz su-exec postgres psql strimz -c \
  'SELECT id, "privyUserId", role, status, "invitedById", "lastLoginAt", "createdAt"
     FROM "AdminUser" ORDER BY "createdAt";'
```

- `adm_bootstrap_emmanuel` with a non-NULL `privyUserId`: the seeded row was claimed.
  Confirm in the Privy dashboard that this DID is the intended operator. If it is anyone
  else, suspend the row before deploying (runbook section 4c).
- `adm_bootstrap_emmanuel` with a NULL `privyUserId`: the migration deletes it, and the
  platform has no admin until the bootstrap command runs (Deploy, step 4).
- Rows with a NULL `privyUserId` and a non-NULL `invitedById` are pending invites. They
  stop working on deploy and must be re-sent (Deploy, step 6).

## What was wrong

- `AdminAuthGuard` looked up the caller's Privy DID and, when no row matched, fetched the
  caller's email from Privy and bound them to any `AdminUser` row with that email and a
  NULL `privyUserId`. No audit row was written.
- Migration `20260609122047_admin_users` inserts a `super_admin` row with a personal
  email and a NULL `privyUserId` into every database. Whoever controlled that mailbox
  could take the highest role in any environment where the row was unclaimed.
- Invited rows were claimed the same way, without expiry and without the invitee
  accepting anything.

## What shipped

- `AdminAuthGuard` admits by Privy DID only. No matching row means
  `403 admin_access_denied`. The guard no longer calls Privy on a miss and never writes
  `privyUserId`.
- Migration `20261003180000_admin_bootstrap_invite_tokens`:
  - deletes `adm_bootstrap_emmanuel` only where `privyUserId IS NULL`;
  - adds `AdminUser.inviteTokenHash` (unique) and `AdminUser.inviteExpiresAt`.
- `admin:bootstrap` command (`apps/api/src/cli/admin-bootstrap.main.ts`, built to
  `dist/cli/admin-bootstrap.main.js`). It creates an active `super_admin` bound to the
  given DID and writes an `admin.bootstrapped` audit row in one transaction. It refuses
  with `invalid_privy_did`, `privy_lookup_failed`, `privy_user_has_no_email`,
  `super_admin_exists` or `admin_already_exists`, exits 1 and writes nothing.
- Invites: `POST /v1/admin/admins` stores a SHA-256 hash of a 32-byte random token,
  expiring in 7 days, and emails `/admin/accept-invite?token=...`.
  `POST /v1/admin/invites/accept { token }` needs a Privy session but no admin row. It
  binds the caller's DID only if the token matches a pending, active, unexpired invite
  and the caller's Privy email equals the invited email (`invite_email_mismatch`
  otherwise). Bad, used or expired tokens get `400 invite_invalid`. Acceptance writes
  `admin.invite_accepted`.
- `POST /v1/admin/admins/:id/invite` (super_admin) re-sends a pending invite with a new
  token; the old token stops working. Writes `admin.invite_resent`.
- `GET /v1/admin/admins` returns `invitePending` and `inviteExpiresAt` per row.
- Web: a new `/admin/accept-invite` page, a pending-invite label and a **Resend invite**
  action on `/admin/admins`, and BFF routes for both writes. The invite email now links
  to the accept page.

## Deploy

1. Run the production check above and act on it.
2. Deploy the web app (Vercel) first or together with the API, so invite links reach a
   page that exists.
3. Deploy the API container (`infra/lightsail/deploy.sh`). The entrypoint runs
   `prisma migrate deploy`, which applies the new migration.
4. If no active `super_admin` exists, create one with the operator's Privy DID:

   ```bash
   docker exec -it strimz sh -c \
     'cd /repo/apps/api && node dist/cli/admin-bootstrap.main.js --privy-did did:privy:<id> --name "<name>"'
   ```

5. Sign in at `/admin` with that Privy account.
6. Re-send every pending invite from `/admin/admins` (**Resend invite**).

On every new environment (local stacks, CI databases, a new server), step 4 is part of
setup: a fresh database has no admin.

## Not covered by automation

The e2e suite covers the guard, both migration paths, the command logic and the invite
flow with a stubbed Privy. These steps are manual on testnet after deploy: run the
production check; run the bootstrap command against real Privy and sign in; invite a
second admin, confirm a plain sign-in with the invited email gets `403`, then accept
through the emailed link.
