import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { effectiveFeeBps } from '@strimz/shared-config'
import type {
  CreatePaymentSessionParsed,
  Mode,
  PaymentCurrency,
  PaymentSession,
} from '@strimz/shared-types'
import type { PaymentSessionStatus, Prisma } from '@strimz/db'
import { TypedConfigService } from '../../config/index.js'
import { assertMinimumAmount } from '../../common/money/minimum-amount.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { MerchantChainService } from '../merchants/merchant-chain.service.js'
import { tokenAddressForCurrency } from './token-resolver.js'

/**
 * Always pull the merchant relation on session reads — the serialiser
 * needs `onchainMerchantId` to populate `chainMerchantId` in the wire
 * payload. Skipping this would force the checkout to do a second
 * round-trip; cheaper to denormalise here.
 */
const WITH_MERCHANT = { include: { merchant: { select: { onchainMerchantId: true } } } } as const

const OPEN_SESSION_STATUSES: PaymentSessionStatus[] = ['created', 'awaiting_payment']

@Injectable()
export class PaymentSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: TypedConfigService,
    private readonly merchantChain: MerchantChainService,
  ) {}

  async create(
    merchantId: string,
    mode: 'test' | 'live',
    input: CreatePaymentSessionParsed,
  ): Promise<PaymentSession> {
    await this.prepareMerchant(merchantId)
    return this.insert(this.prisma.db, merchantId, mode, input)
  }

  async prepareMerchant(merchantId: string): Promise<void> {
    // Lazy on-chain merchant registration. The hosted checkout needs a
    // chain merchant id to render the pay button regardless of mode,
    // so we always ensure the merchant is on the Registry. Idempotent —
    // subsequent calls return the cached id in O(1).
    await this.merchantChain.requestRegistration(merchantId)
  }

  async insert(
    db: Prisma.TransactionClient,
    merchantId: string,
    mode: 'test' | 'live',
    input: CreatePaymentSessionParsed,
    link: { storefrontProductId: string } | null = null,
  ): Promise<PaymentSession> {
    assertMinimumAmount(input.amount)
    const merchant = await db.merchant.findUniqueOrThrow({ where: { id: merchantId } })
    const feeBps = effectiveFeeBps(merchant.tier as never, 'one_shot') ?? 150
    const amount = BigInt(input.amount)
    const feeAmount = (amount * BigInt(feeBps)) / 10_000n
    const netAmount = amount - feeAmount
    const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60_000)

    const customer = input.customer?.walletAddress
      ? await db.customer.upsert({
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

    const row = await db.paymentSession.create({
      data: {
        merchantId,
        customerId: customer?.id ?? null,
        storefrontProductId: link?.storefrontProductId ?? null,
        amount: input.amount,
        currency: input.currency,
        feeAmount: feeAmount.toString(),
        netAmount: netAmount.toString(),
        description: input.description ?? null,
        successUrl: input.successUrl ?? null,
        cancelUrl: input.cancelUrl ?? null,
        checkoutUrl: `${this.cfg.env.CHECKOUT_ORIGIN.replace(/\/$/, '')}/pay/SESSION_ID`,
        mode,
        metadata: (input.metadata ?? {}) as never,
        expiresAt,
      },
    })

    // Patch the checkout URL now that we have the id.
    const finalRow = await db.paymentSession.update({
      where: { id: row.id },
      data: { checkoutUrl: `${this.cfg.env.CHECKOUT_ORIGIN.replace(/\/$/, '')}/pay/${row.id}` },
      ...WITH_MERCHANT,
    })
    return this.serialise(finalRow)
  }

  async retrieve(merchantId: string, mode: Mode, id: string): Promise<PaymentSession> {
    const row = await this.prisma.db.paymentSession.findFirst({
      where: { id, merchantId, mode },
      ...WITH_MERCHANT,
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'session not found' })
    return this.serialise(row)
  }

  /**
   * Public lookup by id — does NOT filter by merchantId. Used by the
   * hosted-checkout public endpoint so a payer landing on a session
   * URL can load the payload without holding any API key. Session
   * data is intrinsically public (this is the payer's checkout view)
   * so this read leaks no merchant-confidential information.
   */
  async retrievePublic(id: string): Promise<PaymentSession> {
    const row = await this.prisma.db.paymentSession.findFirst({
      where: { id },
      ...WITH_MERCHANT,
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'session not found' })
    // Public checkout view: hide the fee split (reveals the merchant's
    // fee tier) and merchant-internal metadata. The payer only needs the
    // amount, currency, and chain fields to sign.
    const s = this.serialise(row)
    return { ...s, feeAmount: '0', netAmount: s.amount, metadata: {} }
  }

  async linkCustomer(sessionId: string, customerId: string): Promise<void> {
    await this.prisma.db.paymentSession.update({
      where: { id: sessionId },
      data: { customerId },
    })
  }

  cancel(merchantId: string, mode: Mode, id: string): Promise<PaymentSession> {
    return this.close(merchantId, mode, id, 'cancelled')
  }

  expire(merchantId: string, mode: Mode, id: string): Promise<PaymentSession> {
    return this.close(merchantId, mode, id, 'expired')
  }

  private async close(
    merchantId: string,
    mode: Mode,
    id: string,
    to: 'cancelled' | 'expired',
  ): Promise<PaymentSession> {
    const { count, row } = await this.prisma.db.$transaction(async (tx) => {
      const { count } = await tx.paymentSession.updateMany({
        where: { id, merchantId, mode, status: { in: OPEN_SESSION_STATUSES } },
        data: { status: to },
      })
      const row = await tx.paymentSession.findFirst({
        where: { id, merchantId, mode },
        ...WITH_MERCHANT,
      })
      if (count === 1 && row?.storefrontProductId) {
        await tx.storefrontProduct.updateMany({
          where: { id: row.storefrontProductId, stock: { not: null } },
          data: { stock: { increment: 1 } },
        })
      }
      return { count, row }
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'session not found' })
    if (count === 0) {
      throw new ForbiddenException({
        code: 'session_invalid_state',
        message: `cannot mark a session in status ${row.status} as ${to}`,
      })
    }
    return this.serialise(row)
  }

  async list(
    merchantId: string,
    mode: Mode,
    params: { limit?: number; cursor?: string | null; status?: string },
  ): Promise<{ data: PaymentSession[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.paymentSession.findMany({
      where: { merchantId, mode, status: (params.status as never) ?? undefined },
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
