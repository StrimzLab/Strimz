import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  FREE_ALLOWANCE_UNITS,
  PAYMENT_TOKENS,
  TOKENS,
  arcModeFor,
  getTokenAddress,
  type PaymentToken,
} from '@strimz/shared-config'
import type { Address, Hex } from 'viem'

import { TypedConfigService } from '../../config/index.js'
import { EmailService } from '../../infra/email/email.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { RefundChainService } from '../../infra/refund-chain/refund-chain.service.js'

const PAGE = 200
const ALERT_EVERY_MS = 24 * 60 * 60 * 1000

export interface FeeRefundResult {
  disabled: boolean
  queued: number
  sent: number
  confirmed: number
}

interface MerchantLink {
  id: string
  payoutAddress: string | null
  walletAddress: string | null
}

/**
 * Refunds the on-chain fee on each business's first FREE_ALLOWANCE_UNITS of volume per
 * currency (ADR-2026-11-21-free-plan-fee-integrity). A payment is refunded at most once
 * (FeeRefund.transactionId is unique), and a transfer is signed and stored before it is
 * broadcast, so a restart resends the same transaction instead of paying twice.
 */
@Injectable()
export class FeeRefundService {
  private readonly log = new Logger(FeeRefundService.name)
  private running = false
  private readonly lastAlert = new Map<string, number>()

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly prisma: PrismaService,
    private readonly chain: RefundChainService,
    private readonly email: EmailService,
  ) {}

  @Cron(process.env.FEE_REFUND_CRON || '0 */15 * * * *', { name: 'fee-refunds' })
  tick(): Promise<FeeRefundResult> {
    return this.runNow()
  }

  async runNow(): Promise<FeeRefundResult> {
    const result: FeeRefundResult = { disabled: false, queued: 0, sent: 0, confirmed: 0 }
    if (!this.chain.address) return { ...result, disabled: true }
    if (this.running) return result
    this.running = true
    try {
      result.confirmed = await this.settleTransfers()
      result.queued = await this.queueRefunds()
      result.sent = await this.payPending()
    } finally {
      this.running = false
    }
    return result
  }

  private get mode(): 'test' | 'live' {
    return arcModeFor(this.cfg.env.ARC_ENVIRONMENT)
  }

  // A transfer is only given up on when the chain shows it reverted. Anything
  // else is resent as signed, so the same refund can never be paid twice.
  private async settleTransfers(): Promise<number> {
    const open = await this.prisma.db.feeRefundTransfer.findMany({
      where: { status: 'signed', mode: this.mode },
      orderBy: { nonce: 'asc' },
    })
    let confirmed = 0
    for (const transfer of open) {
      const status = await this.chain.receiptStatus(transfer.txHash as Hex)
      if (status === 'success') {
        await this.prisma.db.$transaction([
          this.prisma.db.feeRefundTransfer.update({
            where: { id: transfer.id },
            data: { status: 'confirmed' },
          }),
          this.prisma.db.feeRefund.updateMany({
            where: { transferId: transfer.id },
            data: { status: 'refunded' },
          }),
        ])
        confirmed++
        continue
      }
      if (status === 'reverted') {
        await this.prisma.db.$transaction([
          this.prisma.db.feeRefundTransfer.update({
            where: { id: transfer.id },
            data: { status: 'failed' },
          }),
          this.prisma.db.feeRefund.updateMany({
            where: { transferId: transfer.id },
            data: { status: 'pending', transferId: null },
          }),
        ])
        continue
      }
      await this.send(transfer.id, transfer.signedTx as Hex)
    }
    return confirmed
  }

  private async queueRefunds(): Promise<number> {
    const merchants = await this.prisma.db.merchant.findMany({
      // An unregistered account has no on-chain payout and must not link two businesses.
      where: { tier: { not: 'enterprise' }, onchainMerchantId: { not: null } },
      select: { id: true, payoutAddress: true, walletAddress: true },
    })
    let queued = 0
    for (const business of businesses(merchants)) {
      for (const currency of PAYMENT_TOKENS) {
        queued += await this.queueForBusiness(business, currency)
      }
    }
    return queued
  }

  private async queueForBusiness(merchantIds: string[], currency: PaymentToken): Promise<number> {
    const allowance = BigInt(FREE_ALLOWANCE_UNITS) * 10n ** BigInt(TOKENS[currency].decimals)
    const rows: { merchantId: string; transactionId: string; amount: string }[] = []
    let counted = 0n
    let cursor: string | undefined
    while (counted < allowance) {
      const page = await this.prisma.db.transaction.findMany({
        where: {
          merchantId: { in: merchantIds },
          currency,
          mode: this.mode,
          status: 'confirmed',
          kind: { not: 'refund' },
        },
        orderBy: [{ blockTimestamp: 'asc' }, { logIndex: 'asc' }, { id: 'asc' }],
        select: { id: true, merchantId: true, amount: true, feeAmount: true, feeRefund: true },
        take: PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (page.length === 0) break
      const customerRefunded = new Set(
        (
          await this.prisma.db.refund.findMany({
            where: { transactionId: { in: page.map((p) => p.id) }, status: 'completed' },
            select: { transactionId: true },
          })
        ).map((r) => r.transactionId),
      )
      for (const payment of page) {
        if (counted >= allowance) break
        if (customerRefunded.has(payment.id)) continue
        const amount = BigInt(payment.amount)
        const inside = amount < allowance - counted ? amount : allowance - counted
        counted += inside
        const fee = BigInt(payment.feeAmount)
        if (payment.feeRefund || fee === 0n || amount === 0n) continue
        const refund = (fee * inside) / amount
        if (refund > 0n) {
          rows.push({
            merchantId: payment.merchantId,
            transactionId: payment.id,
            amount: refund.toString(),
          })
        }
      }
      cursor = page[page.length - 1]?.id
      if (page.length < PAGE) break
    }
    if (rows.length === 0) return 0
    const { count } = await this.prisma.db.feeRefund.createMany({
      data: rows.map((r) => ({ ...r, currency, mode: this.mode })),
      skipDuplicates: true,
    })
    return count
  }

  private async payPending(): Promise<number> {
    const from = this.chain.address
    if (!from) return 0
    const pending = await this.prisma.db.feeRefund.findMany({
      where: { status: 'pending', transferId: null, mode: this.mode },
      include: { merchant: { select: { payoutAddress: true } } },
    })
    const groups = new Map<string, typeof pending>()
    for (const refund of pending) {
      const key = `${refund.merchantId}:${refund.currency}`
      groups.set(key, [...(groups.get(key) ?? []), refund])
    }

    const spent: Record<PaymentToken, bigint> = { USDC: 0n, EURC: 0n }
    let sent = 0
    for (const group of groups.values()) {
      const first = group[0]
      if (!first) continue
      const to = first.merchant.payoutAddress
      if (!to) {
        this.log.warn(`merchant ${first.merchantId} has no payout address; refund waits`)
        continue
      }
      const currency = first.currency
      const token = getTokenAddress(this.cfg.env.ARC_ENVIRONMENT, currency) as Address
      const amount = group.reduce((sum, r) => sum + BigInt(r.amount), 0n)
      const balance = await this.chain.tokenBalance(token)
      if (balance - spent[currency] < amount) {
        await this.alertLowFloat(currency, amount, balance - spent[currency])
        continue
      }

      const nonce = await this.nextNonce(from)
      const { signedTx, txHash } = await this.chain.signTransfer({
        token,
        to: to as Address,
        amount,
        nonce,
      })
      const ids = group.map((r) => r.id)
      const transferId = await this.prisma.db.$transaction(async (tx) => {
        const transfer = await tx.feeRefundTransfer.create({
          data: {
            merchantId: first.merchantId,
            currency,
            amount: amount.toString(),
            toAddress: to,
            fromAddress: from,
            nonce,
            txHash,
            signedTx,
            mode: this.mode,
          },
        })
        const { count } = await tx.feeRefund.updateMany({
          where: { id: { in: ids }, status: 'pending', transferId: null },
          data: { status: 'sending', transferId: transfer.id },
        })
        if (count !== ids.length) throw new Error('fee refunds changed while being paid')
        return transfer.id
      })
      spent[currency] += amount
      await this.send(transferId, signedTx)
      sent++
    }
    return sent
  }

  private async nextNonce(from: Address): Promise<number> {
    const stored = await this.prisma.db.feeRefundTransfer.aggregate({
      where: { fromAddress: from },
      _max: { nonce: true },
    })
    const chainNonce = await this.chain.nextNonce()
    const afterStored = stored._max.nonce === null ? 0 : stored._max.nonce + 1
    return Math.max(chainNonce, afterStored)
  }

  private async send(transferId: string, signedTx: Hex): Promise<void> {
    try {
      const outcome = await this.chain.broadcast(signedTx)
      if (outcome === 'nonce_used') {
        this.log.error(
          `fee refund transfer ${transferId}: its nonce is used but no receipt yet; check the refund wallet`,
        )
      }
    } catch (err) {
      const message = (err as Error).message
      this.log.error(`fee refund transfer ${transferId} broadcast failed: ${message}`)
      // On Arc this is often the wallet's USDC running out for gas; it is resent next run.
      await this.alertOps(
        'broadcast',
        'Refund transfer could not be sent',
        `<p>The refund wallet <code>${this.chain.address}</code> could not send transfer <code>${transferId}</code>: ${escapeHtml(message)}</p><p>It is resent every run. If the wallet is low on USDC for gas, top it up from the FeeCollector.</p>`,
      )
    }
  }

  private alertLowFloat(currency: PaymentToken, needed: bigint, available: bigint) {
    const decimals = TOKENS[currency].decimals
    return this.alertOps(
      `float:${currency}`,
      `Refund wallet is short of ${currency}`,
      `<p>Fee refunds are waiting. The refund wallet <code>${this.chain.address}</code> needs ${formatUnits(needed, decimals)} ${currency} and holds ${formatUnits(available, decimals)}.</p><p>Top it up from the FeeCollector with a Safe withdrawal.</p>`,
    )
  }

  private async alertOps(key: string, subject: string, html: string): Promise<void> {
    if (Date.now() - (this.lastAlert.get(key) ?? 0) < ALERT_EVERY_MS) return
    this.lastAlert.set(key, Date.now())
    try {
      await this.email.send({ to: this.cfg.env.STRIMZ_ADMIN_ALERT_EMAIL, subject, html })
    } catch (err) {
      this.log.error(`fee refund alert "${subject}" failed: ${(err as Error).message}`)
    }
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/gu, (c) => `&#${c.charCodeAt(0)};`)
}

function formatUnits(value: bigint, decimals: number): string {
  const negative = value < 0n
  const abs = negative ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  const fraction = (abs % base).toString().padStart(decimals, '0').slice(0, 2)
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/** Merchants linked by a payout address or owner wallet, directly or through each other. */
export function businesses(merchants: MerchantLink[]): string[][] {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root) as string
    parent.set(id, root)
    return root
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))
  const byAddress = new Map<string, string>()
  for (const m of merchants) parent.set(m.id, m.id)
  for (const m of merchants) {
    for (const address of [m.payoutAddress, m.walletAddress]) {
      if (!address) continue
      const key = address.toLowerCase()
      const other = byAddress.get(key)
      if (other) union(m.id, other)
      else byAddress.set(key, m.id)
    }
  }
  const groups = new Map<string, string[]>()
  for (const m of merchants) {
    const root = find(m.id)
    groups.set(root, [...(groups.get(root) ?? []), m.id])
  }
  return [...groups.values()]
}
