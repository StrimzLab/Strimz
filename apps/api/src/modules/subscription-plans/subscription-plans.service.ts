import { Injectable, NotFoundException } from '@nestjs/common'
import type {
  CreateSubscriptionPlanInput,
  PaymentCurrency,
  SubscriptionPlan,
} from '@strimz/shared-types'
import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { tokenAddressForCurrency } from '../payment-sessions/token-resolver.js'

const WITH_MERCHANT = { include: { merchant: { select: { onchainMerchantId: true } } } } as const

/**
 * Seconds per interval bucket. Mirrors what `StrimzSubscriptions`
 * expects as its uint32 `interval` argument. `intervalCount` from the
 * plan record multiplies this.
 *
 * `month`/`year` round to 30/365 days respectively — exact-calendar
 * arithmetic isn't possible at the contract level (no calendar lib
 * in Solidity), and on-chain scheduling is per-interval-seconds, so
 * we lock the conversion here and document the rounding.
 */
const SECONDS_PER_INTERVAL: Record<string, number> = {
  day: 24 * 60 * 60,
  week: 7 * 24 * 60 * 60,
  month: 30 * 24 * 60 * 60,
  quarter: 90 * 24 * 60 * 60,
  year: 365 * 24 * 60 * 60,
}

@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: TypedConfigService,
  ) {}

  async create(merchantId: string, input: CreateSubscriptionPlanInput): Promise<SubscriptionPlan> {
    const row = await this.prisma.db.subscriptionPlan.create({
      data: {
        merchantId,
        name: input.name,
        description: input.description ?? null,
        amount: input.amount,
        currency: input.currency,
        interval: input.interval,
        intervalCount: input.intervalCount ?? 1,
        trialPeriodDays: input.trialPeriodDays ?? null,
        metadata: (input.metadata ?? {}) as never,
      },
      ...WITH_MERCHANT,
    })
    return this.serialise(row)
  }

  async retrieve(merchantId: string, id: string): Promise<SubscriptionPlan> {
    const row = await this.prisma.db.subscriptionPlan.findFirst({
      where: { id, merchantId },
      ...WITH_MERCHANT,
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'plan not found' })
    return this.serialise(row)
  }

  async list(
    merchantId: string,
    params: { limit?: number; cursor?: string | null; status?: string },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.subscriptionPlan.findMany({
      where: { merchantId, status: (params.status as never) ?? undefined },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      ...WITH_MERCHANT,
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map((r) => this.serialise(r))
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  async archive(merchantId: string, id: string): Promise<SubscriptionPlan> {
    await this.retrieve(merchantId, id)
    const row = await this.prisma.db.subscriptionPlan.update({
      where: { id },
      data: { status: 'archived' },
      ...WITH_MERCHANT,
    })
    return this.serialise(row)
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private serialise(row: any): SubscriptionPlan {
    const seconds = SECONDS_PER_INTERVAL[row.interval as string] ?? 30 * 24 * 60 * 60
    return {
      ...row,
      chainMerchantId:
        row.merchant?.onchainMerchantId != null ? String(row.merchant.onchainMerchantId) : null,
      tokenAddress: tokenAddressForCurrency(this.cfg, row.currency as PaymentCurrency),
      intervalSeconds: seconds * (row.intervalCount ?? 1),
      metadata: row.metadata ?? {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
