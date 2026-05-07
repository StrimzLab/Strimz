import { Injectable, NotFoundException } from '@nestjs/common'
import type { CreateSubscriptionPlanInput, SubscriptionPlan } from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly prisma: PrismaService) {}

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
    })
    return serialise(row)
  }

  async retrieve(merchantId: string, id: string): Promise<SubscriptionPlan> {
    const row = await this.prisma.db.subscriptionPlan.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'plan not found' })
    return serialise(row)
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
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  async archive(merchantId: string, id: string): Promise<SubscriptionPlan> {
    await this.retrieve(merchantId, id)
    const row = await this.prisma.db.subscriptionPlan.update({
      where: { id },
      data: { status: 'archived' },
    })
    return serialise(row)
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function serialise(row: any): SubscriptionPlan {
  return {
    ...row,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
