import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import type { Refund } from '@strimz/db'
import { getTokenAddress } from '@strimz/shared-config'
import { uuid } from '@strimz/shared-crypto'
import type { Hash } from 'viem'

import { TypedConfigService } from '../../config/index.js'
import { ChainService, type TransferReceipt } from '../../infra/chain/chain.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

const API_VERSION = '2026-04-27'
const BATCH = 50

export interface RefundReconcileResult {
  checked: number
  completed: number
  failed: number
  pending: number
  errors: number
}

// Completes refunds whose transfer the indexer missed (it can land before the
// hash is saved) and fails ones that reverted or paid the wrong thing.
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
          result.pending++
          this.log.warn(`refund ${row.id}: no receipt yet for ${hash}`)
          continue
        }
        if (receipt.status === 'reverted') {
          if (await this.fail(row.id, 'transaction reverted')) result.failed++
        } else if (this.matches(row, receipt)) {
          if (await this.complete(row, receipt.blockTime)) result.completed++
        } else if (await this.fail(row.id, 'transfer did not match token, recipient or amount')) {
          result.failed++
        }
      }
    } finally {
      this.running = false
    }
    if (result.completed + result.failed > 0) {
      this.log.log(`refunds reconciled: ${result.completed} completed, ${result.failed} failed`)
    }
    return result
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

  private async fail(id: string, failureReason: string): Promise<boolean> {
    const { count } = await this.prisma.db.refund.updateMany({
      where: { id, status: 'submitted' },
      data: { status: 'failed', failureReason },
    })
    return count > 0
  }
}
