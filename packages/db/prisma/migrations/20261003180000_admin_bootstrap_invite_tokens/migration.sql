DELETE FROM "AdminUser" WHERE "id" = 'adm_bootstrap_emmanuel' AND "privyUserId" IS NULL;

ALTER TABLE "AdminUser"
    ADD COLUMN "inviteTokenHash" TEXT,
    ADD COLUMN "inviteExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "AdminUser_inviteTokenHash_key" ON "AdminUser"("inviteTokenHash");
