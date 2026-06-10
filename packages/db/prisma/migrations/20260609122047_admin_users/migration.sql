-- AdminUser surface for the Strimz operator-facing dashboard.
--
-- Bootstrap row: the first super_admin is inserted by this migration
-- itself, with `privyUserId` left NULL. The AdminAuthGuard's first
-- successful sign-in (matching by email claim) claims the row by
-- setting `privyUserId` to the Privy claims.userId. This avoids a
-- chicken-and-egg "you need an existing admin to invite the first
-- admin" problem without exposing a public bootstrap endpoint.

CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'admin', 'read_only');
CREATE TYPE "AdminUserStatus" AS ENUM ('active', 'suspended');

ALTER TYPE "AuditActionCategory" ADD VALUE IF NOT EXISTS 'admin';

CREATE TABLE "AdminUser" (
    "id"            TEXT             NOT NULL,
    "privyUserId"   TEXT,
    "email"         VARCHAR(320)     NOT NULL,
    "name"          VARCHAR(120),
    "role"          "AdminRole"      NOT NULL,
    "status"        "AdminUserStatus" NOT NULL DEFAULT 'active',
    "invitedById"   TEXT,
    "invitedAt"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)     NOT NULL,
    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminUser_privyUserId_key" ON "AdminUser"("privyUserId");
CREATE UNIQUE INDEX "AdminUser_email_key"        ON "AdminUser"("email");
CREATE INDEX "AdminUser_role_idx"                ON "AdminUser"("role");
CREATE INDEX "AdminUser_status_idx"              ON "AdminUser"("status");

ALTER TABLE "AdminUser"
    ADD CONSTRAINT "AdminUser_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "AdminUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Bootstrap the first super_admin. `privyUserId` is NULL until the
-- operator's first sign-in claims it via email match.
INSERT INTO "AdminUser" ("id", "email", "name", "role", "updatedAt")
VALUES (
    'adm_bootstrap_emmanuel',
    'emmanuelomemgboji@gmail.com',
    'Emmanuel',
    'super_admin',
    NOW()
);
