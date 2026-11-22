import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import type { Refund } from '@strimz/db'
import { getTokenAddress } from '@strimz/shared-config'
import { uuid } from '@strimz/shared-crypto'
import type { Address, Hash } from 'viem'
import { z } from 'zod'

import { TypedConfigService } from '../../config/index.js'
import { ChainService, type TransferReceipt } from '../../infra/chain/chain.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

const API_VERSION = '2026-04-27'
const BATCH = 50
// A transaction must look dropped on two checks this far apart before the refund fails (#517).
const DROP_CONFIRM_MS = 60_000

const sentTxSchema = z.object({
  from: z.string().regex(/^0x[0-9a-f]{40}$/u),
  nonce: z.number().int().min(0),
})

export interface RefundReconcileResult {
  checked: number
  completed: number
  failed: number
  pending: number
  errors: number
}

// Completes refunds whose transfer the indexer missed (it can land before the
// hash is saved), and fails ones that reverted, paid the wrong thing, or can
// never be mined.
@Injectable()
export class RefundReconcilerService {
  private readonly log = new Logger(RefundReconcilerService.name)
  private running = false

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly chain: ChainService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(process.env.REFUND_RECONCILER_CRON || '*/15 * * * * *', { name: 'refund-reconciler' })
  tick(): Promise<RefundReconcileResult> {
    return this.reconcileNow()
  }

  async reconcileNow(): Promise<RefundReconcileResult> {
    const result: RefundReconcileResult = {
      checked: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      errors: 0,
    }
    if (this.running) return result
    this.running = true
    try {
      const rows = await this.prisma.db.refund.findMany({
        where: { status: 'submitted', refundTxHash: { not: null } },
        orderBy: { createdAt: 'asc' },
        take: BATCH,
      })
      for (const row of rows) {
        result.checked++
        const hash = row.refundTxHash as Hash
        let receipt: TransferReceipt | null
        try {
          receipt = await this.chain.readTransferReceipt(hash)
        } catch (err) {
          result.errors++
          this.log.error(
            `refund ${row.id}: receipt lookup for ${hash} failed: ${(err as Error).message}`,
          )
          continue
        }
        if (!receipt) {
          let dead: boolean
          try {
            dead = await this.cannotBeMined(row, hash)
            // The nonce read can come from a node ahead of the one that answered the
            // receipt read; ask again now that the nonce says the slot is spent.
            if (dead) receipt = await this.chain.readTransferReceipt(hash)
          } catch (err) {
            result.errors++
            this.log.error(
              `refund ${row.id}: nonce check for ${hash} failed: ${(err as Error).message}`,
            )
            continue
          }
          if (!receipt) {
            if (dead && (await this.droppedLongEnough(row))) {
              if (await this.fail(row, 'transaction was replaced or dropped')) result.failed++
            } else {
              result.pending++
              this.log.warn(`refund ${row.id}: no receipt yet for ${hash}`)
            }
            continue
          }
        }
        await this.settle(row, receipt, result)
      }
    } finally {
      this.running = false
    }
    if (result.completed + result.failed > 0) {
      this.log.log(`refunds reconciled: ${result.completed} completed, ${result.failed} failed`)
    }
    return result
  }

  private async settle(
    row: Refund,
    receipt: TransferReceipt,
    result: RefundReconcileResult,
  ): Promise<void> {
    if (receipt.status === 'reverted') {
      if (await this.fail(row, 'transaction reverted')) result.failed++
    } else if (this.matches(row, receipt)) {
      if (await this.complete(row, receipt.blockTime)) result.completed++
    } else if (await this.fail(row, 'transfer did not match token, recipient or amount')) {
      result.failed++
    }
  }

  /** Records when the transaction first looked dropped; true once that was long enough ago. */
  private async droppedLongEnough(refund: Refund): Promise<boolean> {
    const metadata = refund.metadata as Record<string, unknown>
    const since =
      typeof metadata.droppedSince === 'string' ? Date.parse(metadata.droppedSince) : NaN
    if (Number.isFinite(since)) return Date.now() - since >= DROP_CONFIRM_MS
    await this.prisma.db.refund.update({
      where: { id: refund.id },
      data: { metadata: { ...metadata, droppedSince: new Date().toISOString() } },
    })
    return false
  }

  private matches(refund: Refund, receipt: TransferReceipt): boolean {
    const token = getTokenAddress(this.cfg.env.ARC_ENVIRONMENT, refund.currency).toLowerCase()
    const payer = refund.payerAddress.toLowerCase()
    const amount = BigInt(refund.amount)
    return receipt.transfers.some(
      (t) => t.token.toLowerCase() === token && t.to.toLowerCase() === payer && t.value === amount,
    )
  }

  private complete(refund: Refund, completedAt: Date): Promise<boolean> {
    return this.prisma.db.$transaction(async (tx) => {
      const { count } = await tx.refund.updateMany({
        where: { id: refund.id, status: 'submitted' },
        data: { status: 'completed', completedAt },
      })
      if (count === 0) return false
      await tx.webhookEvent.create({
        data: {
          id: `evt_${uuid()}`,
          merchantId: refund.merchantId,
          type: 'refund_completed',
          apiVersion: API_VERSION,
          mode: refund.mode,
          payload: { ref: { kind: 'refund.completed', refundId: refund.id } } as never,
        },
      })
      return true
    })
  }

  // A transaction can only land with its sender's next nonce. Once another
  // transaction has used that nonce, this one never will, so it's safe to free
  // the amount. Without a known nonce we wait: a late broadcast would pay twice.
  private async cannotBeMined(refund: Refund, hash: Hash): Promise<boolean> {
    let sent = sentTxSchema.safeParse((refund.metadata as Record<string, unknown>).refundTx).data
    if (!sent) {
      const seen = await this.chain.readSentTransaction(hash)
      if (!seen) return false
      sent = { from: seen.from.toLowerCase(), nonce: seen.nonce }
      await this.prisma.db.refund.update({
        where: { id: refund.id },
        data: { metadata: { ...(refund.metadata as object), refundTx: sent } },
      })
    }
    return (await this.chain.confirmedNonce(sent.from as Address)) > sent.nonce
  }

  private fail(refund: Refund, failureReason: string): Promise<boolean> {
    return this.prisma.db.$transaction(async (tx) => {
      const { count } = await tx.refund.updateMany({
        where: { id: refund.id, status: 'submitted' },
        data: { status: 'failed', failureReason },
      })
      if (count === 0) return false
      await tx.webhookEvent.create({
        data: {
          id: `evt_${uuid()}`,
          merchantId: refund.merchantId,
          type: 'refund_failed',
          apiVersion: API_VERSION,
          mode: refund.mode,
          payload: { ref: { kind: 'refund.failed', refundId: refund.id } } as never,
        },
      })
      return true
    })
  }
}
