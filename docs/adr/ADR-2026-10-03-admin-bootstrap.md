# ADR: Bootstrap the first super_admin with a server-side command, never by email claim

- **Status:** Accepted 2026-10-03
- **Date:** 2026-10-03
- **Scope:** `packages/db` (one new migration, one schema change for invite tokens),
  `apps/api` (`AdminAuthGuard`, `AdminService.inviteAdmin`, a new invite-accept route, a
  new `admin:bootstrap` command), `apps/web` (an accept-invite page),
  `infra/lightsail/README.md` (runbook). No contract, indexer, scheduler, agent, queue
  payload, webhook payload or published package change.

## Context

- Migration `20260609122047_admin_users` creates `AdminUser` and inserts one row:
  id `adm_bootstrap_emmanuel`, role `super_admin`, status `active`, `privyUserId` NULL,
  and a personal email address (referred to below as "the seeded email"). Applied
  migrations are never edited, so that insert runs on every database Strimz ever
  creates: each developer's machine, CI, the e2e container, testnet and mainnet.
- `AdminAuthGuard` (`apps/api/src/common/guards/admin-auth.guard.ts`) resolves the
  caller in two steps. It looks up `AdminUser` by the verified Privy DID
  (`claims.userId`). If none matches, it fetches the Privy user, takes the address of
  the first linked account of type `email`, finds an `AdminUser` with that email, and if
  that row's `privyUserId` is NULL it writes the caller's DID into it and admits the
  caller with the row's role. No audit row is written for the claim; only a log line
  (`admin bootstrap: claiming row ...`).
- The email fallback is not limited to the seeded row. `AdminService.inviteAdmin`
  creates rows with `privyUserId` NULL for every invite (any of `super_admin`, `admin`,
  `read_only`), and those rows are claimed the same way. An unclaimed row never expires.
- Verified on `main` by the red tests below: a Privy user whose only link to the seeded
  `super_admin` row is a matching email gets `200` on `GET /v1/admin/me`, and the row
  is permanently bound to that user's DID. The same is true for an invited row.
- Privy verifies an email account with a one-time code before linking it, so today the
  role goes to whoever controls the seeded mailbox, in every environment, for as long as
  the row stays unclaimed. That is a standing grant of the highest role to a mailbox
  rather than to a person who chose to accept it, and it puts a personal address in the
  repository. The address stays in git history and in the immutable migration file;
  this ADR cannot remove it from either.
- Admin roles (`AdminRole`): `super_admin` (manages admins: invite, change role,
  suspend, delete), `admin` (merchant write actions and broadcasts), `read_only`.
  Without a `super_admin` nobody can invite anyone.
- Production runs `prisma migrate deploy` from `infra/lightsail/entrypoint.sh` on every
  container start, inside the single Lightsail container (`strimz`). The container
  receives `DATABASE_URL`, `PRIVY_APP_ID` and `PRIVY_APP_SECRET` through
  `docker run --env-file`, so `docker exec` sees the same environment.
- Whether the seeded row was claimed in production is unknown to the author of this ADR.
  The maintainer can check on the server:

  ```bash
  docker exec -it strimz su-exec postgres psql strimz -c \
    'SELECT id, "privyUserId", role, status, "invitedById", "lastLoginAt", "createdAt"
       FROM "AdminUser" ORDER BY "createdAt";'
  ```

  `adm_bootstrap_emmanuel` with a non-NULL `privyUserId` means it was claimed; that DID
  should be confirmed as the intended operator in the Privy dashboard. Rows with NULL
  `privyUserId` and non-NULL `invitedById` are pending invites.

- Issue #135.

## Decision

1. **A new migration removes the seeded row only if it was never claimed.**
   `DELETE FROM "AdminUser" WHERE "id" = 'adm_bootstrap_emmanuel' AND "privyUserId" IS NULL;`
   An operator who already claimed it keeps the row, its role and its DID, so nobody is
   locked out. An unclaimed row has never signed in, so it cannot be the sender of an
   `AdminBroadcast` (`ON DELETE RESTRICT`) or the inviter of another admin. A fresh
   database ends with no admin at all.
2. **The guard admits by Privy DID only.** `AdminAuthGuard` drops the email fallback:
   no `AdminUser` row bound to `claims.userId` means `403 admin_access_denied`. The
   guard no longer calls `privy.getUser` and no longer writes `privyUserId`.
3. **The first super_admin is created by a command run on the server.**
   `apps/api/src/cli/admin-bootstrap.ts` exports
   `bootstrapSuperAdmin({ prisma, privy }, { privyUserId, name? })`, and a thin entry
   `admin-bootstrap.main.ts` parses `--privy-did` and `--name`, builds a Prisma client
   from `DATABASE_URL` and a Privy client from `PRIVY_APP_ID` / `PRIVY_APP_SECRET`, and
   exits non-zero on any failure. `apps/api/package.json` gains
   `"admin:bootstrap": "node dist/cli/admin-bootstrap.main.js"`. In production:

   ```bash
   docker exec -it strimz sh -c \
     'cd /repo/apps/api && node dist/cli/admin-bootstrap.main.js --privy-did did:privy:<id> --name "<name>"'
   ```

   The command, in one transaction:
   - rejects a value that does not start with `did:privy:` (`invalid_privy_did`);
   - fetches the Privy user (a Privy error fails the command) and takes its email with
     `PrivyService.primaryEmail`; no email means `privy_user_has_no_email`;
   - refuses if any `super_admin` with status `active` exists (`super_admin_exists`),
     so it cannot be used as a second door once the platform has an owner;
   - refuses if a row already holds that DID or that email (`admin_already_exists`);
   - inserts the `super_admin` with `privyUserId` set and writes an `AuditLog` row
     (`category: admin`, `action: admin.bootstrapped`, `targetType: AdminUser`,
     `actorId` NULL, `metadata.via: cli`).

   Errors are an exported `AdminBootstrapError` with a `code`. The operator finds their
   DID in the Privy dashboard (Users), or as `Merchant.privyUserId` if they have signed
   in to the merchant dashboard.

4. **Invites are accepted with a one-time token, not claimed by email.** `AdminUser`
   gains `inviteTokenHash` (unique, nullable, SHA-256 of a 32-byte random token) and
   `inviteExpiresAt`. `inviteAdmin` stores the hash, sets expiry to 7 days, and emails a
   link to `/admin/accept-invite?token=...`. A new route
   `POST /v1/admin/invites/accept { token }` requires a valid Privy session but no
   `AdminUser`, and in one conditional update binds the caller's DID to the row whose
   hash matches, whose `privyUserId` is NULL, whose status is `active` and whose invite
   has not expired, and clears the hash. It also requires the Privy user's verified
   email to equal the invited email, so a forwarded link alone is not enough. A
   `super_admin` can re-send an invite, which issues a new token and invalidates the
   old one. Acceptance writes `admin.invite_accepted` to the audit log.
5. **Existing pending invites are not auto-claimable after deploy.** Their
   `inviteTokenHash` is NULL, so they wait until a `super_admin` re-sends them.
6. **Comments made false by this change** (listed for a human to correct, per
   Directive 6; the agent edits none of them): the class comment and the "Path 2"
   comment in `admin-auth.guard.ts`, the `privyUserId` and `invitedById` doc comments
   in `packages/db/prisma/schema/admins.prisma`. The header comment in the applied
   migration stays as it is, because applied migrations are not edited.
7. **Runbook.** `infra/lightsail/README.md` gains a "First admin" section with the
   command above and the production check query from Context.

## Diagram

```mermaid
sequenceDiagram
  participant Op as Operator (shell on server)
  participant CLI as admin:bootstrap
  participant P as Privy API
  participant DB as Postgres
  participant G as AdminAuthGuard
  Note over DB: new migration: DELETE seeded row WHERE privyUserId IS NULL
  Op->>CLI: --privy-did did:privy:X
  CLI->>P: getUser(did:privy:X)
  P-->>CLI: user + verified email
  CLI->>DB: BEGIN; any active super_admin? no
  CLI->>DB: INSERT AdminUser(super_admin, privyUserId = X); INSERT AuditLog; COMMIT
  Op->>G: GET /v1/admin/me (Privy token for X)
  G->>DB: AdminUser WHERE privyUserId = X
  DB-->>G: super_admin
  G-->>Op: 200
  Note over G: no row for the DID means 403, whatever the email
```

## Consequences

- No email address, on its own, ever grants an admin role again, in any environment.
- A fresh database, including every new environment, has no admin until an operator
  runs the command once. That is a deliberate deploy step, written into the runbook.
- Becoming the first super_admin requires shell access to the server and the database
  credentials, which is the same trust boundary as running migrations.
- Pending invites from before the deploy must be re-sent. Invitees click a link
  instead of simply signing in.
- The guard does one database lookup per request and no Privy API call on a miss, so
  a denied caller costs less than today.
- One more migration on the admin tables and two columns on `AdminUser`.

## Alternatives considered

- **One-time env-var token (`ADMIN_BOOTSTRAP_TOKEN`) presented to a public
  `POST /v1/admin/bootstrap` with a Privy session.** Lost: it adds an internet-facing
  route that grants the highest role, the token sits in the env file after use unless
  someone removes it and restarts, and whoever presents it first wins. The command
  needs no route and nothing stays behind.
- **Env var naming the first super_admin's DID, applied at boot.** Lost: the grant is
  re-applied on every boot from configuration, so deleting or demoting that admin is
  silently undone, and a typo in the env file decides who owns the platform.
- **Suspend the seeded row instead of deleting it.** Lost: it keeps the personal address
  in every database, the unique email blocks a later invite to that address, and a
  suspended `super_admin` row is one status update away from active.
- **Keep the email fallback but restrict it to invited rows (`invitedById` set).**
  Lost: invites would still grant a role to whoever controls a mailbox, with no expiry
  and no explicit acceptance, which is what #135 asks to end. It is the interim
  behaviour if the maintainer splits Decision 4 into a follow-up issue.
- **Remove the email fallback without an invite token.** Lost: every invite after the
  deploy would be unusable, because an invited row can no longer be bound to a DID.

## Decisions for the maintainer

1. **Bootstrap mechanism.** Recommendation: the server-side command (Decision 3).
2. **Delete or suspend the unclaimed seeded row.** Recommendation: delete, conditioned
   on `privyUserId IS NULL`.
3. **Invite tokens in this change or a follow-up.** Recommendation: this change. If
   split, the guard keeps the email fallback for invited rows only until the follow-up
   lands, and the second guard red test below stays red until then.
4. **Break-glass when every super_admin is lost.** Recommendation: the command keeps
   refusing while an active `super_admin` exists; recovery is a documented `psql`
   update by whoever holds the database credentials, recorded by hand in the audit log.
5. **Production state.** Run the query in Context before merge. If the seeded row was
   claimed, confirm the DID belongs to the intended operator; if it was claimed by
   anyone else, suspend it first.

## Verification

- Red first, failing on `main` (written and run, see below):
  - `apps/api/test/e2e/admin-bootstrap.e2e.test.ts`
    - a Privy user whose only link to the seeded `super_admin` row is a matching email
      gets `403 admin_access_denied` and the row stays unclaimed (fails on `main`:
      `200`);
    - the same for an invited `admin` row (fails on `main`: `200`);
    - a freshly migrated database has no `AdminUser` row (fails on `main`: the seeded
      row);
    - a database migrated through `20260609122047_admin_users` with the row unclaimed,
      then upgraded, no longer has the row (fails on `main`: row present);
    - regression guards that pass on `main` and must keep passing: an admin bound to the
      caller's DID is admitted; a DID bound to nothing is denied even when its email
      matches a bound admin; a seeded row claimed before the upgrade survives it with its
      DID, role and status.
  - `apps/api/test/e2e/admin-bootstrap-cli.e2e.test.ts` (fails on `main`: the module
    `src/cli/admin-bootstrap.ts` does not exist): the command creates an active
    `super_admin` bound to the DID who can then call `/v1/admin/me`; writes one
    `admin.bootstrapped` audit row; refuses with `super_admin_exists`,
    `invalid_privy_did` and `privy_user_has_no_email` and writes nothing.
  - Invite-token tests are written in Phase 2 once the route shape is approved: accept
    with a valid token binds the DID and clears the hash; an expired, reused, or unknown
    token is rejected; a token presented by a Privy user with a different email is
    rejected; re-send invalidates the previous token.
- The migration tests apply the real migration directory with `prisma migrate deploy`,
  so they exercise the same path as `infra/lightsail/entrypoint.sh`.
- `./scripts/preflight.sh` in full.
- On testnet after deploy: run the production query; confirm the seeded row is gone or
  still bound to the confirmed DID; run the command on a fresh local stack and sign in;
  invite a second admin, accept through the link, and confirm a plain sign-in with the
  invited email before accepting gets `403`.
