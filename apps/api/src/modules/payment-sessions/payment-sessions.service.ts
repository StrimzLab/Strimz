import { Injectable, NotFoundException } from '@nestjs/common'
import { effectiveFeeBps } from '@strimz/shared-config'
import type {
  CreatePaymentSessionInput,
  PaymentCurrency,
  PaymentSession,
} from '@strimz/shared-types'
import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { tokenAddressForCurrency } from './token-resolver.js'

/**
 * Always pull the merchant relation on session reads — the serialiser
 * needs `onchainMerchantId` to populate `chainMerchantId` in the wire
 * payload. Skipping this would force the checkout to do a second
 * round-trip; cheaper to denormalise here.
 */
const WITH_MERCHANT = { include: { merchant: { select: { onchainMerchantId: true } } } } as const

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
      ...WITH_MERCHANT,
    })
    return this.serialise(finalRow)
  }

  async retrieve(merchantId: string, id: string): Promise<PaymentSession> {
    const row = await this.prisma.db.paymentSession.findFirst({
      where: { id, merchantId },
      ...WITH_MERCHANT,
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'session not found' })
    return this.serialise(row)
  }

  async cancel(merchantId: string, id: string): Promise<PaymentSession> {
    await this.retrieve(merchantId, id)
    const updated = await this.prisma.db.paymentSession.update({
      where: { id },
      data: { status: 'cancelled' },
      ...WITH_MERCHANT,
    })
    return this.serialise(updated)
  }

  async expire(merchantId: string, id: string): Promise<PaymentSession> {
    await this.retrieve(merchantId, id)
    const updated = await this.prisma.db.paymentSession.update({
      where: { id },
      data: { status: 'expired' },
      ...WITH_MERCHANT,
    })
    return this.serialise(updated)
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
      ...WITH_MERCHANT,
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map((r) => this.serialise(r))
    return {
      data,
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
      hasMore,
    }
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private serialise(row: any): PaymentSession {
    return {
      id: row.id,
      merchantId: row.merchantId,
      // The merchant's on-chain registry id. Stays a decimal string on
      // the wire to keep the bigint shape consistent with the relay
      // submission payloads. Null until the merchant is registered.
      chainMerchantId:
        row.merchant?.onchainMerchantId != null ? String(row.merchant.onchainMerchantId) : null,
      // Token contract address for the session's currency on the
      // active chain. Comes from env config so we don't hit the
      // TokenWhitelist on every read.
      tokenAddress: tokenAddressForCurrency(this.cfg, row.currency as PaymentCurrency),
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
}
