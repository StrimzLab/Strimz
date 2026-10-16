-- CreateTable
CREATE TABLE "IndexerDeadLetter" (
    "id" TEXT NOT NULL,
    "environment" "ArcEnvironment" NOT NULL,
    "contractAddress" VARCHAR(42) NOT NULL,
    "txHash" VARCHAR(66) NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" VARCHAR(66) NOT NULL,
    "blockTimestamp" TIMESTAMP(3) NOT NULL,
    "topics" TEXT[],
    "data" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IndexerDeadLetter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndexerDeadLetter_environment_resolvedAt_blockNumber_idx" ON "IndexerDeadLetter"("environment", "resolvedAt", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IndexerDeadLetter_txHash_logIndex_key" ON "IndexerDeadLetter"("txHash", "logIndex");
