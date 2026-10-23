ALTER TABLE "Merchant" ADD COLUMN "onchainFeeBps" INTEGER,
ADD COLUMN "onchainMaxFeeBps" INTEGER,
ADD COLUMN "onchainFeeTxHash" VARCHAR(66),
ADD COLUMN "onchainFeeChangedAt" TIMESTAMP(3);
