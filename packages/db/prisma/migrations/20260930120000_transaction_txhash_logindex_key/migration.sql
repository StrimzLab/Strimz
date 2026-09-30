-- DropIndex
DROP INDEX "Transaction_onchainTxHash_key";
-- CreateIndex
CREATE INDEX "Transaction_onchainTxHash_idx" ON "Transaction"("onchainTxHash");
-- CreateIndex
CREATE UNIQUE INDEX "Transaction_onchainTxHash_logIndex_key" ON "Transaction"("onchainTxHash", "logIndex");
