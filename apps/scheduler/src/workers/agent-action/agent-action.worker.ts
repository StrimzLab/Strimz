import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import type { Address } from 'viem'
import { ChainService } from '../../infra/chain/chain.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { TOKEN_ADDRESSES } from '@strimz/shared-config'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'
import { agentActionJobSchema, type AgentActionJob } from '../../infra/queue/job-payloads.js'
import { TypedConfigService } from '../../config/index.js'

/**
 * Consumes `strimz.agent.action` — every off-chain command that needs to
 * be reflected on-chain. The discriminated union in `agentActionJobSchema`
 * is exhaustive over what the API enqueues; an unknown `type` is a bug,
 * not a failure-to-process.
 */
@Processor(QUEUE_NAMES.agentAction)
export class AgentActionWorker extends WorkerHost {
  private readonly log = new Logger(AgentActionWorker.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
    private readonly cfg: TypedConfigService,
  ) {
    super()
  }

  async process(job: Job<AgentActionJob>): Promise<{ txHash: string }> {
    const data = agentActionJobSchema.parse(job.data)
    switch (data.type) {
      case 'subscription.cancel-onchain':
        return this.cancelSubscription(data)
      case 'job.create-onchain':
        return this.createJob(data)
      case 'job.release-onchain':
        return this.releaseJob(data)
      case 'job.dispute-onchain':
        return this.disputeJob(data)
      case 'job.cancel-onchain':
        return this.cancelJob(data)
      case 'routing.cctp.settle':
        return this.settleCctpRouting(data)
    }
  }

  private async settleCctpRouting(
    data: Extract<AgentActionJob, { type: 'routing.cctp.settle' }>,
  ): Promise<{ txHash: string }> {
    const txHash = await this.chain.receiveCctpMessage({
      messageHex: data.messageHex as `0x${string}`,
      attestationHex: data.attestationHex as `0x${string}`,
    })
    this.log.log(
      `cctp settle merchant=${data.merchantId} src=${data.sourceTxHash} → ${txHash}`,
    )
    return { txHash }
  }

  private async cancelSubscription(
    data: Extract<AgentActionJob, { type: 'subscription.cancel-onchain' }>,
  ): Promise<{ txHash: string }> {
    if (data.onchainSubscriptionId == null) {
      // No on-chain id yet — the subscription may have been cancelled
      // before the indexer projected it. Off-chain status is already
      // 'cancelled' (the API set it), so this is a no-op.
      this.log.warn(`sub ${data.subscriptionId} has no on-chain id — skipping`)
      return { txHash: '0xskipped' }
    }
    const txHash = await this.chain.cancelSubscription(BigInt(data.onchainSubscriptionId))
    this.log.log(`broadcast cancelSubscription onchain=${data.onchainSubscriptionId} tx=${txHash}`)
    return { txHash }
  }

  private async createJob(
    data: Extract<AgentActionJob, { type: 'job.create-onchain' }>,
  ): Promise<{ txHash: string }> {
    const job = await this.prisma.db.agentJob.findUniqueOrThrow({ where: { id: data.jobId } })
    const tokenAddress = this.tokenAddressFor(job.currency)
    const txHash = await this.chain.createJob({
      vendor: job.vendorAddress as Address,
      assessor: job.assessorAddress as Address,
      token: tokenAddress,
      amount: BigInt(job.amount),
      description: job.description,
    })
    await this.prisma.db.agentJob.update({
      where: { id: job.id },
      data: { escrowTxHash: txHash, status: 'in_progress' },
    })
    return { txHash }
  }

  private async releaseJob(
    data: Extract<AgentActionJob, { type: 'job.release-onchain' }>,
  ): Promise<{ txHash: string }> {
    const job = await this.prisma.db.agentJob.findUniqueOrThrow({ where: { id: data.jobId } })
    if (job.onchainJobId == null) throw new Error('job has no onchain id; indexer not caught up')
    const txHash = await this.chain.approveAndReleaseJob(BigInt(job.onchainJobId))
    return { txHash }
  }

  private async disputeJob(
    data: Extract<AgentActionJob, { type: 'job.dispute-onchain' }>,
  ): Promise<{ txHash: string }> {
    const job = await this.prisma.db.agentJob.findUniqueOrThrow({ where: { id: data.jobId } })
    if (job.onchainJobId == null) throw new Error('job has no onchain id; indexer not caught up')
    const txHash = await this.chain.disputeJob(BigInt(job.onchainJobId), data.reason)
    return { txHash }
  }

  private async cancelJob(
    data: Extract<AgentActionJob, { type: 'job.cancel-onchain' }>,
  ): Promise<{ txHash: string }> {
    const job = await this.prisma.db.agentJob.findUniqueOrThrow({ where: { id: data.jobId } })
    if (job.onchainJobId == null) throw new Error('job has no onchain id; indexer not caught up')
    const txHash = await this.chain.cancelJob(BigInt(job.onchainJobId), data.reason)
    return { txHash }
  }

  private tokenAddressFor(currency: 'USDC' | 'EURC' | string): Address {
    const env = this.cfg.env.ARC_ENVIRONMENT
    const tokens = TOKEN_ADDRESSES[env]
    const sym = currency.toUpperCase() as keyof typeof tokens
    const addr = tokens[sym]
    if (!addr) throw new Error(`no token address for ${currency} on ${env}`)
    return addr as Address
  }
}
