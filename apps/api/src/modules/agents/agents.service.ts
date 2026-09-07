import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  AgentJob,
  AgentMerchantConfig,
  CreateAgentJobInput,
  UpdateAgentConfigInput,
} from '@strimz/shared-types'
import { AGENT_DEFAULTS } from '@strimz/shared-config'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { QueueService, QUEUE_NAMES } from '../../infra/queue/queue.service.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  // ----- Config -----

  async retrieveConfig(merchantId: string): Promise<AgentMerchantConfig> {
    const row =
      (await this.prisma.db.agentMerchantConfig.findUnique({ where: { merchantId } })) ??
      (await this.prisma.db.agentMerchantConfig.create({
        data: { merchantId, enabledCapabilities: [] },
      }))
    return serialiseConfig(row)
  }

  async updateConfig(
    merchantId: string,
    input: UpdateAgentConfigInput,
  ): Promise<AgentMerchantConfig> {
    await this.prisma.db.agentMerchantConfig.upsert({
      where: { merchantId },
      create: { merchantId, enabledCapabilities: [] },
      update: {},
    })
    const updated = await this.prisma.db.agentMerchantConfig.update({
      where: { merchantId },
      data: {
        enabledCapabilities: input.enabledCapabilities as never,
        recoveryGracePeriodHours: input.recovery?.gracePeriodHours,
        recoveryStrategy: input.recovery?.strategy,
        recoveryNotificationTemplate: input.recovery?.notificationTemplate ?? undefined,
        cashflowDigestEnabled: input.cashflow?.digestEnabled,
        cashflowAnomalySensitivity: input.cashflow?.anomalySensitivity,
        cashflowAutoConvertToYield: input.cashflow?.autoConvertToYield,
        cashflowMinimumLiquidReserveCents: input.cashflow?.minimumLiquidReserveCents,
        commerceHumanApprovalAboveUsdCents: input.commerce?.requireHumanApprovalAboveUsdCents,
        commerceApprovedVendors: input.commerce?.approvedVendors as never,
        commerceMonthlySpendCapUsdCents: input.commerce?.monthlySpendCapUsdCents ?? undefined,
      },
    })
    return serialiseConfig(updated)
  }

  // ----- Activity -----

  async listActivity(
    merchantId: string,
    params: { limit?: number; cursor?: string | null; capability?: string; outcome?: string },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.agentActivityLog.findMany({
      where: {
        merchantId,
        capability: (params.capability as never) ?? undefined,
        outcome: (params.outcome as never) ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialiseActivity)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  // ----- Jobs (ERC-8183) -----

  async listJobs(
    merchantId: string,
    params: { limit?: number; cursor?: string | null; status?: string },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.agentJob.findMany({
      where: { merchantId, status: (params.status as never) ?? undefined },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialiseJob)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  async retrieveJob(merchantId: string, id: string): Promise<AgentJob> {
    const row = await this.prisma.db.agentJob.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'job not found' })
    return serialiseJob(row)
  }

  async createJob(merchantId: string, input: CreateAgentJobInput): Promise<AgentJob> {
    const cfg = await this.retrieveConfig(merchantId)

    if (!cfg.enabledCapabilities.includes('commerce')) {
      throw new ForbiddenException({
        code: 'capability_disabled',
        message: 'commerce capability is not enabled for this merchant',
      })
    }

    const vendor = input.vendorAddress.toLowerCase()
    const allowlist = cfg.commerce.approvedVendors.map((v) => v.toLowerCase())
    if (allowlist.length > 0 && !allowlist.includes(vendor)) {
      throw new ForbiddenException({
        code: 'vendor_not_allowed',
        message: 'vendor is not on the approved vendor list',
      })
    }

    if (cfg.commerce.monthlySpendCapUsdCents != null) {
      const monthStart = new Date()
      monthStart.setUTCDate(1)
      monthStart.setUTCHours(0, 0, 0, 0)
      const monthJobs = await this.prisma.db.agentJob.findMany({
        where: {
          merchantId,
          createdAt: { gte: monthStart },
          // Exclude jobs whose escrow was returned to the client.
          // `reclaimed` is a full timeout refund and `cancelled` a
          // pre-start refund — counting either against the cap charges
          // the merchant budget for money that came back. `resolved` is
          // a partial split, so it stays counted until the split amounts
          // are projected onto the row.
          status: { notIn: ['cancelled', 'disputed', 'reclaimed'] },
        },
        select: { amount: true },
      })
      const spent = monthJobs.reduce((acc, j) => acc + BigInt(j.amount), 0n)
      const cap = BigInt(cfg.commerce.monthlySpendCapUsdCents) * 10_000n
      if (spent + BigInt(input.amount) > cap) {
        throw new ForbiddenException({
          code: 'spend_cap_exceeded',
          message: 'monthly commerce spend cap exceeded',
        })
      }
    }

    const assessor =
      input.assessorAddress ??
      // Fall back to merchant's payout address as assessor if none provided.
      (
        await this.prisma.db.merchant.findUniqueOrThrow({
          where: { id: merchantId },
          select: { payoutAddress: true },
        })
      ).payoutAddress

    if (!assessor) {
      throw new NotFoundException({
        code: 'invalid_request',
        message: 'no assessor address provided and merchant has no payout address',
      })
    }

    const row = await this.prisma.db.agentJob.create({
      data: {
        merchantId,
        vendorAddress: input.vendorAddress,
        description: input.description,
        amount: input.amount,
        currency: input.currency,
        assessorAddress: assessor,
        status:
          BigInt(input.amount) > BigInt(cfg.commerce.requireHumanApprovalAboveUsdCents) * 10_000n
            ? 'proposed'
            : 'accepted',
      },
    })

    if (row.status === 'accepted') {
      await this.queue.queue(QUEUE_NAMES.agentAction).add('job.create-onchain', { jobId: row.id })
    }
    return serialiseJob(row)
  }

  async approveJob(merchantId: string, id: string): Promise<AgentJob> {
    const row = await this.prisma.db.agentJob.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'job not found' })

    // Only approvable states may enqueue on-chain funding; approving an
    // already-accepted job would fund the escrow twice. Atomic guard:
    // the update matches zero rows if the status moved concurrently.
    const { count } = await this.prisma.db.agentJob.updateMany({
      where: { id: row.id, status: { in: ['proposed', 'delivered'] } },
      data: { status: 'accepted' },
    })
    if (count === 0) {
      throw new ForbiddenException({
        code: 'job_invalid_state',
        message: `cannot approve a job in status ${row.status}`,
      })
    }
    await this.queue.queue(QUEUE_NAMES.agentAction).add('job.create-onchain', { jobId: row.id })
    const updated = await this.prisma.db.agentJob.findUniqueOrThrow({ where: { id: row.id } })
    return serialiseJob(updated)
  }
}

function serialiseConfig(row: any): AgentMerchantConfig {
  return {
    merchantId: row.merchantId,
    enabledCapabilities: row.enabledCapabilities,
    recovery: {
      gracePeriodHours: row.recoveryGracePeriodHours as 24 | 48 | 72,
      strategy: row.recoveryStrategy,
      notificationTemplate: row.recoveryNotificationTemplate,
    },
    cashflow: {
      digestEnabled: row.cashflowDigestEnabled,
      anomalySensitivity: row.cashflowAnomalySensitivity,
      autoConvertToYield: row.cashflowAutoConvertToYield,
      minimumLiquidReserveCents: row.cashflowMinimumLiquidReserveCents,
    },
    commerce: {
      requireHumanApprovalAboveUsdCents: row.commerceHumanApprovalAboveUsdCents,
      approvedVendors: row.commerceApprovedVendors,
      monthlySpendCapUsdCents: row.commerceMonthlySpendCapUsdCents,
    },
    updatedAt: row.updatedAt.toISOString(),
  } as AgentMerchantConfig & { defaults?: typeof AGENT_DEFAULTS }
}

function serialiseActivity(row: any) {
  return {
    id: row.id,
    merchantId: row.merchantId,
    capability: row.capability,
    actionType: row.actionType,
    outcome: row.outcome,
    subscriptionId: row.subscriptionId,
    transactionId: row.transactionId,
    jobId: row.jobId,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt.toISOString(),
  }
}

function serialiseJob(row: any): AgentJob {
  return {
    id: row.id,
    merchantId: row.merchantId,
    onchainJobId: row.onchainJobId,
    vendorAddress: row.vendorAddress,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    assessorAddress: row.assessorAddress,
    deliverableHash: row.deliverableHash,
    escrowTxHash: row.escrowTxHash,
    releaseTxHash: row.releaseTxHash,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  } as AgentJob
}
