-- CreateEnum
CREATE TYPE "FeeRefundStatus" AS ENUM ('pending', 'sending', 'refunded');

-- CreateEnum
CREATE TYPE "FeeRefundTransferStatus" AS ENUM ('signed', 'confirmed', 'failed');

-- CreateTable
CREATE TABLE "FeeRefund" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "amount" VARCHAR(78) NOT NULL,
    "mode" "Mode" NOT NULL,
    "status" "FeeRefundStatus" NOT NULL DEFAULT 'pending',
    "transferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRefundTransfer" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "amount" VARCHAR(78) NOT NULL,
    "toAddress" VARCHAR(42) NOT NULL,
    "fromAddress" VARCHAR(42) NOT NULL,
    "nonce" INTEGER NOT NULL,
    "txHash" VARCHAR(66) NOT NULL,
    "signedTx" TEXT NOT NULL,
    "status" "FeeRefundTransferStatus" NOT NULL DEFAULT 'signed',
    "mode" "Mode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRefundTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeRefund_transactionId_key" ON "FeeRefund"("transactionId");

-- CreateIndex
CREATE INDEX "FeeRefund_status_mode_idx" ON "FeeRefund"("status", "mode");

-- CreateIndex
CREATE INDEX "FeeRefund_merchantId_idx" ON "FeeRefund"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRefundTransfer_txHash_key" ON "FeeRefundTransfer"("txHash");

-- CreateIndex
CREATE INDEX "FeeRefundTransfer_status_idx" ON "FeeRefundTransfer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRefundTransfer_fromAddress_nonce_key" ON "FeeRefundTransfer"("fromAddress", "nonce");

-- AddForeignKey
ALTER TABLE "FeeRefund" ADD CONSTRAINT "FeeRefund_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRefund" ADD CONSTRAINT "FeeRefund_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRefund" ADD CONSTRAINT "FeeRefund_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "FeeRefundTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRefundTransfer" ADD CONSTRAINT "FeeRefundTransfer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
