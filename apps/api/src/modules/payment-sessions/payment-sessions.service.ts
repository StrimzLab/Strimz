import { Injectable, NotFoundException } from '@nestjs/common'
import { effectiveFeeBps } from '@strimz/shared-config'
import type { CreatePaymentSessionInput, PaymentSession } from '@strimz/shared-types'
import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

@Injectable()
export class PaymentSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: TypedConfigService,
  ) {}

  async create(
    merchantId: string,
    mode: 'test' | 'live',
    input: CreatePaymentSessionInput,
  ): Promise<PaymentSession> {
    const merchant = await this.prisma.db.merchant.findUniqueOrThrow({ where: { id: merchantId } })
    const feeBps = effectiveFeeBps(merchant.tier as never, 'one_shot') ?? 150
    const amount = BigInt(input.amount)
    const feeAmount = (amount * BigInt(feeBps)) / 10_000n
    const netAmount = amount - feeAmount
    const expiresAt = new Date(Date.now() + (input.expiresInMinutes ?? 30) * 60_000)

    const customer = input.customer?.walletAddress
      ? await this.prisma.db.customer.upsert({
          where: {
            merchantId_walletAddress: { merchantId, walletAddress: input.customer.walletAddress },
          },
          create: {
            merchantId,
            walletAddress: input.customer.walletAddress,
            email: input.customer.email,
            externalRef: input.customer.externalRef,
          },
          update: {
            email: input.customer.email ?? undefined,
            externalRef: input.customer.externalRef ?? undefined,
            lastSeenAt: new Date(),
          },
        })
      : null

    const row = await this.prisma.db.paymentSession.create({
      data: {
        merchantId,
        customerId: customer?.id ?? null,
        amount: input.amount,
        currency: input.currency,
        feeAmount: feeAmount.toString(),
        netAmount: netAmount.toString(),
        description: input.description ?? null,
        successUrl: input.successUrl ?? null,
        cancelUrl: input.cancelUrl ?? null,
        checkoutUrl: `${this.cfg.env.API_BASE_URL.replace(/\/$/, '')}/checkout/SESSION_ID`,
        mode,
        metadata: (input.metadata ?? {}) as never,
        expiresAt,
      },
    })

    // Patch the checkout URL now that we have the id.
    const finalRow = await this.prisma.db.paymentSession.update({
      where: { id: row.id },
      data: { checkoutUrl: `${this.cfg.env.API_BASE_URL.replace(/\/$/, '')}/checkout/${row.id}` },
    })
    return serialise(finalRow)
  }

  async retrieve(merchantId: string, id: string): Promise<PaymentSession> {
    const row = await this.prisma.db.paymentSession.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'session not found' })
    return serialise(row)
  }

  async cancel(merchantId: string, id: string): Promise<PaymentSession> {
    await this.retrieve(merchantId, id)
    const updated = await this.prisma.db.paymentSession.update({
      where: { id },
      data: { status: 'cancelled' },
    })
    return serialise(updated)
  }

  async expire(merchantId: string, id: string): Promise<PaymentSession> {
    await this.retrieve(merchantId, id)
    const updated = await this.prisma.db.paymentSession.update({
      where: { id },
      data: { status: 'expired' },
    })
    return serialise(updated)
  }

  async list(
    merchantId: string,
    params: { limit?: number; cursor?: string | null; status?: string },
  ): Promise<{ data: PaymentSession[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.paymentSession.findMany({
      where: { merchantId, status: (params.status as never) ?? undefined },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return {
      data,
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
      hasMore,
    }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function serialise(row: any): PaymentSession {
  return {
    id: row.id,
    merchantId: row.merchantId,
    customerId: row.customerId,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    feeAmount: row.feeAmount,
    netAmount: row.netAmount,
    description: row.description,
    payerWalletAddress: row.payerWalletAddress,
    payerEmail: row.payerEmail,
    successUrl: row.successUrl,
    cancelUrl: row.cancelUrl,
    sourceChain: row.sourceChain,
    bridgeTxHash: row.bridgeTxHash,
    onchainTxHash: row.onchainTxHash,
    checkoutUrl: row.checkoutUrl,
    metadata: row.metadata ?? {},
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
