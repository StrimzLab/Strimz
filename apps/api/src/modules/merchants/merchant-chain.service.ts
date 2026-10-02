import { Injectable, Logger, PreconditionFailedException } from '@nestjs/common'
import type { Hex } from 'viem'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { QueueService } from '../../infra/queue/queue.service.js'

import { registryReadAbi } from './registry.abi.js'
import { registrationGaps } from './registration.js'

/**
 * Bridges a Strimz merchant row to its on-chain identity in
 * `StrimzRegistry`. Lazy and idempotent: the first call for a merchant
 * submits the registration tx via the relayer (which holds
 * `MERCHANT_REGISTRAR_ROLE`); every subsequent call returns the cached
 * id from Postgres.
 *
 * Called from `PaymentSessionsService.create` and
 * `SubscriptionPlansService.create` in live mode only. Test-mode flows
 * never touch the chain — the SDK still works without an on-chain id.
 */
@Injectable()
export class MerchantChainService {
  private readonly log = new Logger(MerchantChainService.name)
  private readonly registryAddress: Hex
  private readonly chainId: number

  constructor(
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
    private readonly queue: QueueService,
    cfg: TypedConfigService,
  ) {
    const addr = cfg.env.STRIMZ_REGISTRY_ADDRESS
    if (!addr) {
      throw new Error('STRIMZ_REGISTRY_ADDRESS not configured')
    }
    this.registryAddress = addr as Hex
    this.chainId = chain.client.chain?.id ?? 0
  }

  async requestRegistration(merchantId: string): Promise<void> {
    const m = await this.registrationState(merchantId)
    if (m.onchainMerchantId !== null) return
    const missing = registrationGaps(m)
    if (missing.length > 0) {
      throw new PreconditionFailedException({
        code: 'merchant_not_eligible_for_onchain_registration',
        message: `cannot register on-chain — missing: ${missing.join(', ')}`,
        missing,
      })
    }
    await this.enqueueRegistration(merchantId)
  }

  async startRegistrationIfEligible(merchantId: string): Promise<boolean> {
    const m = await this.registrationState(merchantId)
    if (m.onchainMerchantId !== null || registrationGaps(m).length > 0) return false
    await this.enqueueRegistration(merchantId)
    return true
  }

  /** Snapshot the merchant's current chain state without forcing a
   *  registration write. Used by the dashboard `chain-status` endpoint. */
  async getStatus(merchantId: string): Promise<{
    onchainMerchantId: bigint | null
    walletAddress: string | null
    payoutAddress: string | null
    eligible: boolean
    missing: string[]
  }> {
    const m = await this.prisma.db.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: {
        onchainMerchantId: true,
        walletAddress: true,
        payoutAddress: true,
        onboardingCompleted: true,
      },
    })
    const missing = registrationGaps(m)
    return {
      onchainMerchantId: m.onchainMerchantId !== null ? BigInt(m.onchainMerchantId) : null,
      walletAddress: m.walletAddress,
      payoutAddress: m.payoutAddress,
      eligible: missing.length === 0,
      missing,
    }
  }

  private registrationState(merchantId: string) {
    return this.prisma.db.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: {
        onchainMerchantId: true,
        walletAddress: true,
        payoutAddress: true,
        onboardingCompleted: true,
      },
    })
  }

  private async enqueueRegistration(merchantId: string): Promise<void> {
    await this.queue.addRelaySubmission({
      reason: 'registerMerchant',
      idempotencyKey: `merchant-register:${merchantId}`,
      merchantInternalId: merchantId,
    })
    await this.prisma.db.merchant.update({
      where: { id: merchantId },
      data: { onchainRegistrationRequestedAt: new Date() },
    })
  }

  /**
   * Read the current on-chain merchant record so the dashboard can
   * render pending owner / pending payout / timer / fee cap. Returns
   * `null` when the merchant has not registered on-chain yet, or when
   * the RPC read fails (the dashboard renders "unknown" in that case).
   */
  async getOnchainState(merchantInternalId: string): Promise<OnchainMerchantState | null> {
    const row = await this.prisma.db.merchant.findUnique({
      where: { id: merchantInternalId },
      select: { onchainMerchantId: true },
    })
    if (!row?.onchainMerchantId) return null

    try {
      const [record, delaySeconds] = await Promise.all([
        this.chain.client.readContract({
          address: this.registryAddress,
          abi: registryReadAbi,
          functionName: 'getMerchant',
          args: [BigInt(row.onchainMerchantId)],
        }),
        this.chain.client.readContract({
          address: this.registryAddress,
          abi: registryReadAbi,
          functionName: 'PAYOUT_CHANGE_DELAY',
        }),
      ])
      return {
        onchainMerchantId: row.onchainMerchantId,
        registryAddress: this.registryAddress,
        chainId: this.chainId,
        owner: record.owner,
        payoutAddress: record.payoutAddress,
        feeBps: record.feeBps,
        maxFeeBps: record.maxFeeBps,
        active: record.active,
        pendingOwner:
          record.pendingOwner === '0x0000000000000000000000000000000000000000'
            ? null
            : record.pendingOwner,
        pendingPayoutAddress:
          record.pendingPayoutAddress === '0x0000000000000000000000000000000000000000'
            ? null
            : record.pendingPayoutAddress,
        payoutChangeCommitAt: Number(record.payoutChangeCommitAt) || null,
        payoutChangeDelaySeconds: Number(delaySeconds),
      }
    } catch (err) {
      const message = (err as Error).message
      // Registry says the id is not there. Treat as "not registered
      // yet" so the dashboard renders the enrolment-pending state
      // instead of an error banner.
      if (message.includes('Registry__UnknownMerchant')) return null
      this.log.warn(`getOnchainState read failed: ${message}`)
      return null
    }
  }
}

export interface OnchainMerchantState {
  onchainMerchantId: number
  registryAddress: `0x${string}`
  chainId: number
  owner: `0x${string}`
  payoutAddress: `0x${string}`
  feeBps: number
  maxFeeBps: number
  active: boolean
  pendingOwner: `0x${string}` | null
  pendingPayoutAddress: `0x${string}` | null
  payoutChangeCommitAt: number | null
  payoutChangeDelaySeconds: number
}
