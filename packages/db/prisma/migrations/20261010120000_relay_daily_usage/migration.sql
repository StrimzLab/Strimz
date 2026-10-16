CREATE TABLE "RelayDailyUsage" (
    "merchantId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "submissions" INTEGER NOT NULL DEFAULT 0,
    "gasUsedWei" DECIMAL(78,0) NOT NULL DEFAULT 0,
    "warnedAt" TIMESTAMP(3),
    "exhaustedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelayDailyUsage_pkey" PRIMARY KEY ("merchantId","day")
);

ALTER TABLE "RelayDailyUsage" ADD CONSTRAINT "RelayDailyUsage_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
