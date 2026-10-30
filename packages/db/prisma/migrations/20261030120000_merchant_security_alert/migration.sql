-- CreateTable
CREATE TABLE "MerchantSecurityAlert" (
    "id" TEXT NOT NULL,
    "auditLogId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "MerchantSecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantSecurityAlert_auditLogId_key" ON "MerchantSecurityAlert"("auditLogId");

-- CreateIndex
CREATE INDEX "MerchantSecurityAlert_notifiedAt_createdAt_idx" ON "MerchantSecurityAlert"("notifiedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "MerchantSecurityAlert" ADD CONSTRAINT "MerchantSecurityAlert_auditLogId_fkey" FOREIGN KEY ("auditLogId") REFERENCES "AuditLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantSecurityAlert" ADD CONSTRAINT "MerchantSecurityAlert_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

