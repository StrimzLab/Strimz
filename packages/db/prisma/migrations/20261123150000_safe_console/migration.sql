-- CreateEnum
CREATE TYPE "SafeProposalStatus" AS ENUM ('collecting', 'ready', 'executing', 'executed', 'failed', 'stale');

-- CreateTable
CREATE TABLE "SafeProposal" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "safeAddress" VARCHAR(42) NOT NULL,
    "action" JSONB NOT NULL,
    "to" VARCHAR(42) NOT NULL,
    "data" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "safeTxHash" VARCHAR(66) NOT NULL,
    "status" "SafeProposalStatus" NOT NULL DEFAULT 'collecting',
    "timelockTarget" VARCHAR(42),
    "timelockData" TEXT,
    "timelockSalt" VARCHAR(66),
    "timelockOperationId" VARCHAR(66),
    "scheduledById" TEXT,
    "proposedById" TEXT NOT NULL,
    "executedById" TEXT,
    "executeTxHash" VARCHAR(66),
    "failureReason" VARCHAR(500),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafeProposalSignature" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "signer" VARCHAR(42) NOT NULL,
    "signature" VARCHAR(132) NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafeProposalSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SafeProposal_safeTxHash_key" ON "SafeProposal"("safeTxHash");

-- CreateIndex
CREATE UNIQUE INDEX "SafeProposal_executeTxHash_key" ON "SafeProposal"("executeTxHash");

-- CreateIndex
CREATE INDEX "SafeProposal_safeAddress_status_idx" ON "SafeProposal"("safeAddress", "status");

-- CreateIndex
CREATE INDEX "SafeProposal_timelockOperationId_idx" ON "SafeProposal"("timelockOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "SafeProposalSignature_proposalId_signer_key" ON "SafeProposalSignature"("proposalId", "signer");

-- AddForeignKey
ALTER TABLE "SafeProposal" ADD CONSTRAINT "SafeProposal_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES "SafeProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafeProposalSignature" ADD CONSTRAINT "SafeProposalSignature_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "SafeProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

