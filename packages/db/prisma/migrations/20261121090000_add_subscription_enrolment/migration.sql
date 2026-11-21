CREATE TABLE "SubscriptionEnrolment" (
    "intentNonce" VARCHAR(66) NOT NULL,
    "merchantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "payerAddress" VARCHAR(42) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEnrolment_pkey" PRIMARY KEY ("intentNonce")
);

CREATE INDEX "SubscriptionEnrolment_merchantId_payerAddress_idx" ON "SubscriptionEnrolment"("merchantId", "payerAddress");

ALTER TABLE "SubscriptionEnrolment" ADD CONSTRAINT "SubscriptionEnrolment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubscriptionEnrolment" ADD CONSTRAINT "SubscriptionEnrolment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
