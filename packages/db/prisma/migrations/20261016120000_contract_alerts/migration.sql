CREATE TABLE "ContractAlert" (
    "id" TEXT NOT NULL,
    "auditLogId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertedAt" TIMESTAMP(3),

    CONSTRAINT "ContractAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractAlert_auditLogId_key" ON "ContractAlert"("auditLogId");

CREATE INDEX "ContractAlert_alertedAt_createdAt_idx" ON "ContractAlert"("alertedAt", "createdAt");

ALTER TABLE "ContractAlert" ADD CONSTRAINT "ContractAlert_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
