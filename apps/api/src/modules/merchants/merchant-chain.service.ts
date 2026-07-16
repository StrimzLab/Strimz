import { randomUUID } from 'node:crypto'
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  PreconditionFailedException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { decodeEventLog, encodeFunctionData, hexToBigInt, type Hex } from 'viem'
import { effectiveFeeBps } from '@strimz/shared-config'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { KMS_SIGNER } from '../../infra/kms/kms.tokens.js'
import type { KmsSigner } from '../../infra/kms/kms.types.js'
import { toKmsAccount } from '../../infra/kms/kms-account.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { RedisService } from '../../infra/redis/redis.service.js'
import { GasPricingService } from '../relay/gas-pricing.service.js'
import { NonceManager } from '../relay/nonce-manager.service.js'

import { registerMerchantAbi, registryReadAbi } from './registry.abi.js'

/** Required gas budget for `registerMerchant`. A simple SSTORE-heavy
 *  write fits comfortably under 200k; 300k leaves headroom for an
 *  occasionally pricey storage-slot write. */
const REGISTER_MERCHANT_GAS_LIMIT = 300_000n

/** Hard ceiling on time spent waiting for a sibling registration to
 *  complete before giving up. The chain side of `registerMerchant`
 *  resolves in seconds on Arc; 60s is generous. */
const SIBLING_WAIT_TIMEOUT_MS = 60_000
const SIBLING_POLL_INTERVAL_MS = 1_000

/** Default parent merchant id — `0` means "no parent" in the registry's
 *  sub-tenancy model. Sub-tenanting will land as a separate feature. */
const NO_PARENT = 0n

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
    private readonly nonces: NonceManager,
    private readonly gas: GasPricingService,
    private readonly redis: RedisService,
    @Inject(KMS_SIGNER) private readonly signer: KmsSigner,
    cfg: TypedConfigService,
  ) {
    const addr = cfg.env.STRIMZ_REGISTRY_ADDRESS
    if (!addr) {
      throw new Error('STRIMZ_REGISTRY_ADDRESS not configured')
    }
    this.registryAddress = addr as Hex
    this.chainId = chain.client.chain?.id ?? 0
  }

  /**
   * Resolve a merchant to its on-chain id, registering them if needed.
   * Idempotent. Safe under concurrent callers — a sibling registration
   * for the same merchant blocks until the first one persists, then
   * returns the same id.
   *
   * Throws `PreconditionFailedException` if the merchant lacks an
   * address or hasn't completed onboarding — fix and retry semantics,
   * never a silent fallback to `null`.
   */
  async ensureRegistered(merchantId: string): Promise<bigint> {
    const cached = await this.readOnchainId(merchantId)
    if (cached !== null) return cached

    const lockKey = `merchant:${merchantId}:onchain-register`
    const lockToken = randomUUID()
    // 180s covers a generous worst-case: nonce contention + chain
    // congestion + receipt wait. If the holder dies, the lock expires
    // and the next caller retries from scratch.
    const acquired = await this.redis.client.set(lockKey, lockToken, 'EX', 180, 'NX')

    if (acquired !== 'OK') {
      // Another request is mid-flight. Poll the row instead of failing
      // fast — by the time we surface a 409 the sibling has usually
      // landed.
      return this.awaitSiblingRegistration(merchantId)
    }

    try {
      // Re-read under the lock. The fast-path read above is a TOCTOU
      // window — a sibling could have completed between then and now.
      const recheck = await this.readOnchainId(merchantId)
      if (recheck !== null) return recheck

      return await this.registerAndPersist(merchantId)
    } finally {
      // Best-effort release. Only delete if the value is still ours;
      // an expired-then-reacquired lock must not be freed by us.
      await this.redis.client
        .eval(
          `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`,
          1,
          lockKey,
          lockToken,
        )
        .catch((err: unknown) =>
          this.log.warn(`lock release failed for ${lockKey}: ${(err as Error).message}`),
        )
    }
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
    const missing = this.prerequisiteGaps(m)
    return {
      onchainMerchantId: m.onchainMerchantId !== null ? BigInt(m.onchainMerchantId) : null,
      walletAddress: m.walletAddress,
      payoutAddress: m.payoutAddress,
      eligible: missing.length === 0,
      missing,
    }
  }

  // ----- internals -----

  private async readOnchainId(merchantId: string): Promise<bigint | null> {
    const m = await this.prisma.db.merchant.findUnique({
      where: { id: merchantId },
      select: { onchainMerchantId: true },
    })
    return m?.onchainMerchantId != null ? BigInt(m.onchainMerchantId) : null
  }

  private async awaitSiblingRegistration(merchantId: string): Promise<bigint> {
    const deadline = Date.now() + SIBLING_WAIT_TIMEOUT_MS
    while (Date.now() < deadline) {
      await sleep(SIBLING_POLL_INTERVAL_MS)
      const id = await this.readOnchainId(merchantId)
      if (id !== null) return id
    }
    throw new ConflictException({
      code: 'onchain_registration_in_progress',
      message: 'an on-chain registration for this merchant is already in flight; retry shortly',
    })
  }

  private async registerAndPersist(merchantId: string): Promise<bigint> {
    const merchant = await this.prisma.db.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: {
        id: true,
        tier: true,
        walletAddress: true,
        payoutAddress: true,
        onboardingCompleted: true,
      },
    })

    const missing = this.prerequisiteGaps(merchant)
    if (missing.length > 0) {
      throw new PreconditionFailedException({
        code: 'merchant_not_eligible_for_onchain_registration',
        message: `cannot register on-chain — missing: ${missing.join(', ')}`,
        missing,
      })
    }

    const feeBps =
      effectiveFeeBps(merchant.tier as Parameters<typeof effectiveFeeBps>[0], 'one_shot') ?? 150
    const owner = merchant.walletAddress as Hex
    const payout = merchant.payoutAddress as Hex

    const callData = encodeFunctionData({
      abi: registerMerchantAbi,
      functionName: 'registerMerchant',
      args: [owner, payout, feeBps, NO_PARENT],
    })

    const txHash = await this.submitTx(callData)
    this.log.log(
      `registerMerchant submitted: merchant=${merchantId} owner=${owner} payout=${payout} feeBps=${feeBps} tx=${txHash}`,
    )

    const onchainId = await this.awaitMerchantId(txHash)

    await this.prisma.db.merchant.update({
      where: { id: merchantId },
      data: { onchainMerchantId: Number(onchainId) },
    })

    this.log.log(`merchant ${merchantId} registered on-chain as id=${onchainId}`)
    return onchainId
  }

  /** Submit a calldata blob as the relayer. Mirrors the relay processor's
   *  nonce + fee dance so concurrent submissions from both call sites
   *  share a single nonce sequence. */
  private async submitTx(callData: Hex): Promise<Hex> {
    const nonce = await this.nonces.acquire(this.chainId, this.signer.address)
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.gas.compute()
    const account = toKmsAccount(this.signer)
    const serialized = await account.signTransaction({
      type: 'eip1559',
      chainId: this.chainId,
      nonce: Number(nonce),
      to: this.registryAddress,
      data: callData,
      value: 0n,
      gas: REGISTER_MERCHANT_GAS_LIMIT,
      maxFeePerGas,
      maxPriorityFeePerGas,
    })
    return this.chain.client.sendRawTransaction({ serializedTransaction: serialized })
  }

  /** Wait for the registration tx and pull the assigned merchantId out
   *  of the `MerchantRegistered` event. Throws if the tx reverts or no
   *  matching event is found. */
  private async awaitMerchantId(txHash: Hex): Promise<bigint> {
    const receipt = await this.chain.client.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
      pollingInterval: 500,
    })
    if (receipt.status !== 'success') {
      throw new ServiceUnavailableException({
        code: 'onchain_registration_reverted',
        message: `registerMerchant reverted in tx ${txHash}`,
      })
    }

    for (const logEntry of receipt.logs) {
      if (logEntry.address.toLowerCase() !== this.registryAddress.toLowerCase()) continue
      try {
        const decoded = decodeEventLog({
          abi: registerMerchantAbi,
          data: logEntry.data,
          topics: logEntry.topics,
        })
        if (decoded.eventName === 'MerchantRegistered') {
          return decoded.args.merchantId
        }
      } catch {
        // Not the event we want — skip.
      }
    }

    // Fall back to topic decode in case the ABI matcher missed (e.g.
    // proxy re-encoding). The merchantId is indexed → topics[1].
    const fallback = receipt.logs.find(
      (l) => l.address.toLowerCase() === this.registryAddress.toLowerCase() && l.topics.length >= 2,
    )
    if (fallback?.topics[1]) {
      return hexToBigInt(fallback.topics[1])
    }

    throw new ServiceUnavailableException({
      code: 'onchain_registration_event_missing',
      message: `MerchantRegistered event not found in tx ${txHash}`,
    })
  }

  private prerequisiteGaps(m: {
    walletAddress: string | null
    payoutAddress: string | null
    onboardingCompleted: boolean
  }): string[] {
    const gaps: string[] = []
    if (!m.walletAddress) gaps.push('walletAddress')
    if (!m.payoutAddress) gaps.push('payoutAddress')
    if (!m.onboardingCompleted) gaps.push('onboardingCompleted')
    return gaps
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
