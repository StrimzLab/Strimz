# Runbook: first super_admin, admin invites, and break-glass

Applies to the single Lightsail container (`strimz`, see `infra/lightsail/README.md`).
Background: [ADR-2026-10-03-admin-bootstrap](../adr/ADR-2026-10-03-admin-bootstrap.md).

An admin role is granted only to a Privy user ID (a "DID", shaped `did:privy:...`). An
email address on its own never grants a role. There are three ways a DID gets a role:

| Situation                                 | How                                                      |
| ----------------------------------------- | -------------------------------------------------------- |
| No active `super_admin` exists            | `admin:bootstrap` command on the server (section 2)      |
| A `super_admin` adds someone              | Invite from `/admin/admins`, invitee accepts (section 3) |
| Every `super_admin` is lost or locked out | Manual `psql` procedure (section 4)                      |

## 1. Check the current admins

```bash
docker exec -it strimz su-exec postgres psql strimz -c \
  'SELECT id, "privyUserId", role, status, "invitedById", "inviteExpiresAt", "lastLoginAt", "createdAt"
     FROM "AdminUser" ORDER BY "createdAt";'
```

- `privyUserId` set: the admin can sign in with that Privy account.
- `privyUserId` NULL: a pending invite. If `inviteExpiresAt` is NULL or in the past, the
  invite has no usable link and must be re-sent.

Before the `20261003180000_admin_bootstrap_invite_tokens` migration has run, the
`inviteExpiresAt` column does not exist; drop it from the query.

## 2. Create the first super_admin

Use this once per environment, when no `super_admin` with status `active` exists (for
example a fresh database, or right after the release that removed the seeded row).

1. Find the operator's Privy DID: Privy dashboard, Users, open the user, copy the ID
   (`did:privy:...`). If the operator has signed in to the merchant dashboard, it is
   also their `Merchant.privyUserId`:

   ```bash
   docker exec -it strimz su-exec postgres psql strimz -c \
     "SELECT \"privyUserId\", email FROM \"Merchant\" WHERE email = '<operator email>';"
   ```

2. Run the command inside the container:

   ```bash
   docker exec -it strimz sh -c \
     'cd /repo/apps/api && node dist/cli/admin-bootstrap.main.js --privy-did did:privy:<id> --name "<name>"'
   ```

   `--name` is optional. The command reads `DATABASE_URL`, `PRIVY_APP_ID` and
   `PRIVY_APP_SECRET` from the container environment. On success it prints the new
   admin row as JSON and exits 0. It writes the admin row and an `admin.bootstrapped`
   audit row in one transaction.

3. Sign in at `https://<dashboard>/admin` with that Privy account.

The command exits 1 and writes nothing when it refuses:

| Error                      | Meaning                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `invalid_privy_did`        | The value does not start with `did:privy:`.                               |
| `privy_lookup_failed`      | Privy did not return the user (wrong DID, wrong app credentials, outage). |
| `privy_user_has_no_email`  | The Privy user has no email. Link one in Privy and retry.                 |
| `super_admin_exists`       | An active `super_admin` exists. Invite from the dashboard instead.        |
| `admin_already_exists`     | An `AdminUser` row already holds that DID or that email.                  |
| `invalid environment: ...` | A required environment variable is missing.                               |

## 3. Invite another admin

1. A `super_admin` opens `/admin/admins`, clicks **Invite admin**, and enters the email
   and role.
2. The invitee receives a link to `/admin/accept-invite?token=...`. It works once and
   expires after 7 days. Only a SHA-256 hash of the token is stored.
3. The invitee opens the link, signs in through Privy with the invited email address,
   and clicks **Accept invite**. A Privy account with a different email is refused
   (`invite_email_mismatch`).
4. Signing in without accepting gives `403 admin_access_denied`.

To re-send, open the row menu on `/admin/admins` and choose **Resend invite**. This issues
a new link and the previous one stops working. Invites created before this release have
no link and must be re-sent.

## 4. Break-glass: no usable super_admin

Use this only when nobody can sign in as an active `super_admin`, for example when the
only `super_admin` was suspended, or when the operator lost access to their Privy
account. It needs a shell on the server, which is the same trust boundary as the
bootstrap command. Record every step in the audit log as shown.

Open a psql session:

```bash
docker exec -it strimz su-exec postgres psql strimz
```

### 4a. Reactivate a suspended super_admin

```sql
BEGIN;
UPDATE "AdminUser" SET status = 'active', "updatedAt" = NOW()
 WHERE id = '<admin id>' AND role = 'super_admin';
INSERT INTO "AuditLog" (id, category, action, "targetType", "targetId", metadata)
VALUES ('brk_' || md5(random()::text), 'admin', 'admin.break_glass_reactivated',
        'AdminUser', '<admin id>',
        jsonb_build_object('via', 'psql', 'operator', '<your name>', 'reason', '<why>'));
COMMIT;
```

### 4b. Rebind a super_admin to a new Privy account

First confirm in the Privy dashboard that the new DID belongs to the same person.

```sql
BEGIN;
UPDATE "AdminUser" SET "privyUserId" = 'did:privy:<new id>', "updatedAt" = NOW()
 WHERE id = '<admin id>' AND role = 'super_admin';
INSERT INTO "AuditLog" (id, category, action, "targetType", "targetId", metadata)
VALUES ('brk_' || md5(random()::text), 'admin', 'admin.break_glass_rebound',
        'AdminUser', '<admin id>',
        jsonb_build_object('via', 'psql', 'operator', '<your name>', 'reason', '<why>',
                           'previousPrivyUserId', '<old did>', 'privyUserId', 'did:privy:<new id>'));
COMMIT;
```

### 4c. Start over with a new super_admin

Suspend every `super_admin` that can no longer be used, then run the bootstrap command
from section 2. A suspended `super_admin` does not block the command.

```sql
BEGIN;
UPDATE "AdminUser" SET status = 'suspended', "updatedAt" = NOW()
 WHERE id = '<admin id>' AND role = 'super_admin';
INSERT INTO "AuditLog" (id, category, action, "targetType", "targetId", metadata)
VALUES ('brk_' || md5(random()::text), 'admin', 'admin.break_glass_suspended',
        'AdminUser', '<admin id>',
        jsonb_build_object('via', 'psql', 'operator', '<your name>', 'reason', '<why>'));
COMMIT;
```

The command refuses an email that an existing row already holds, so if the new Privy
account uses the same email as the suspended row, use 4b instead.
