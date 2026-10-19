CREATE INDEX "PaymentSession_merchantId_customerId_idx" ON "PaymentSession"("merchantId", "customerId");

CREATE INDEX "Refund_transactionId_idx" ON "Refund"("transactionId");
