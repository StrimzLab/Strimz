ALTER TABLE "IndexerCursor" ADD COLUMN "chainId" INTEGER;
UPDATE "IndexerCursor" SET "chainId" = 5042002 WHERE environment = 'testnet';
UPDATE "IndexerCursor" SET "chainId" = 5042 WHERE environment = 'mainnet';
ALTER TABLE "IndexerCursor" ALTER COLUMN "chainId" SET NOT NULL;
ALTER TABLE "IndexerCursor" DROP CONSTRAINT "IndexerCursor_pkey";
ALTER TABLE "IndexerCursor" ADD CONSTRAINT "IndexerCursor_pkey"
  PRIMARY KEY ("chainId", "contractAddress");

ALTER TABLE "IndexerDeadLetter" ADD COLUMN "chainId" INTEGER;
UPDATE "IndexerDeadLetter" SET "chainId" = 5042002 WHERE environment = 'testnet';
UPDATE "IndexerDeadLetter" SET "chainId" = 5042 WHERE environment = 'mainnet';
ALTER TABLE "IndexerDeadLetter" ALTER COLUMN "chainId" SET NOT NULL;
DROP INDEX "IndexerDeadLetter_txHash_logIndex_key";
CREATE UNIQUE INDEX "IndexerDeadLetter_chainId_txHash_logIndex_key"
  ON "IndexerDeadLetter"("chainId", "txHash", "logIndex");
DROP INDEX "IndexerDeadLetter_environment_resolvedAt_blockNumber_idx";
CREATE INDEX "IndexerDeadLetter_chainId_resolvedAt_blockNumber_idx"
  ON "IndexerDeadLetter"("chainId", "resolvedAt", "blockNumber");
