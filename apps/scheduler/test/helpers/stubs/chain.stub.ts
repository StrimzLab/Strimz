/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Address } from 'viem'
import type { ChainService } from '../../../src/infra/chain/chain.service.js'

/** What the contract does with a charge attempt, for the stub's `chargeOutcomes` queue. */
export type StubChargeOutcome = 'Charged' | 'TransferFailed' | 'InsufficientFunds'

type Methods<T> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? K : never]: T[K]
}

/**
 * Records every write call without broadcasting. `txHash` defaults to a
 * deterministic synthetic value so callers can assert on it.
 */
export class StubChainService implements Methods<ChainService> {
  public readonly account = { address: '0x0000000000000000000000000000000000000001' as Address }
  public readonly subscriptionsAddress: Address = '0x0000000000000000000000000000000000000001'
  public readonly agentEscrowAddress: Address = '0x0000000000000000000000000000000000000002'
  public readonly messageTransmitterAddress: Address = '0x000000000000000000000000000000000000cccc'

  public readonly publicClient: any = {}
  public readonly walletClient: any = {}

  public readonly calls: { fn: string; args: unknown[] }[] = []
  public attemptUsedAnswers = new Map<string, boolean>()
  public attemptUsedDefault = false
  public chargeDueAnswers = new Map<bigint, boolean>()
  public chargeDueDefault = true
  public cancelledOnchain = new Set<bigint>()
  public failNext = false
  public registryFees = new Map<bigint, number>()
  public registryFeeDefault = 0
  public feeWriteFailures = new Set<bigint>()
  /** Fee increases the scheduler key scheduled, as the Registry holds them. */
  public pendingFees = new Map<bigint, { feeBps: number; effectiveAt: bigint }>()
  public chainNow = BigInt(Math.floor(Date.now() / 1000))
  /**
   * Outcomes for the next batchCharge calls, in order, applied like the
   * contract: a transfer that ran burns the id, and only a successful
   * one ends the period.
   */
  public chargeOutcomes: StubChargeOutcome[] = []

  onModuleInit(): Promise<void> {
    return Promise.resolve()
  }

  reset() {
    this.calls.length = 0
    this.attemptUsedAnswers.clear()
    this.attemptUsedDefault = false
    this.chargeDueAnswers.clear()
    this.chargeDueDefault = true
    this.cancelledOnchain.clear()
    this.failNext = false
    this.registryFees.clear()
    this.registryFeeDefault = 0
    this.feeWriteFailures.clear()
    this.pendingFees.clear()
    this.chainNow = BigInt(Math.floor(Date.now() / 1000))
    this.chargeOutcomes.length = 0
  }

  private record(fn: string, args: unknown[]): `0x${string}` {
    if (this.failNext) {
      this.failNext = false
      throw new Error('stub chain: failNext')
    }
    this.calls.push({ fn, args })
    return ('0x' + 'a'.repeat(63) + this.calls.length.toString(16)) as `0x${string}`
  }

  isSubscriptionCancelled(subscriptionId: bigint): Promise<boolean> {
    return Promise.resolve(this.cancelledOnchain.has(subscriptionId))
  }
  cancelSubscription(subscriptionId: bigint): Promise<`0x${string}`> {
    return Promise.resolve(this.record('cancelSubscription', [subscriptionId]))
  }
  batchCharge(ids: readonly bigint[], attempts: readonly `0x${string}`[]): Promise<`0x${string}`> {
    const hash = this.record('batchCharge', [ids, attempts])
    ids.forEach((id, i) => {
      const outcome = this.chargeOutcomes.shift()
      const attempt = attempts[i]
      if (outcome === undefined || outcome === 'InsufficientFunds' || attempt === undefined) return
      this.attemptUsedAnswers.set(attempt, true)
      if (outcome === 'Charged') this.chargeDueAnswers.set(id, false)
    })
    return Promise.resolve(hash)
  }
  isAttemptUsed(id: `0x${string}`): Promise<boolean> {
    return Promise.resolve(this.attemptUsedAnswers.get(id) ?? this.attemptUsedDefault)
  }
  isChargeDue(subscriptionId: bigint): Promise<boolean> {
    return Promise.resolve(this.chargeDueAnswers.get(subscriptionId) ?? this.chargeDueDefault)
  }
  createJob(input: any): Promise<`0x${string}`> {
    return Promise.resolve(this.record('createJob', [input]))
  }
  approveAndReleaseJob(jobId: bigint): Promise<`0x${string}`> {
    return Promise.resolve(this.record('approveAndReleaseJob', [jobId]))
  }
  disputeJob(jobId: bigint, reason: string): Promise<`0x${string}`> {
    return Promise.resolve(this.record('disputeJob', [jobId, reason]))
  }
  cancelJob(jobId: bigint, reason: string): Promise<`0x${string}`> {
    return Promise.resolve(this.record('cancelJob', [jobId, reason]))
  }
  receiveCctpMessage(input: {
    messageHex: `0x${string}`
    attestationHex: `0x${string}`
  }): Promise<`0x${string}`> {
    return Promise.resolve(this.record('receiveCctpMessage', [input]))
  }

  readMerchantFeeBps(onchainMerchantId: bigint): Promise<number> {
    return Promise.resolve(this.registryFees.get(onchainMerchantId) ?? this.registryFeeDefault)
  }
  setMerchantFeeBps(onchainMerchantId: bigint, feeBps: number): Promise<`0x${string}`> {
    if (this.feeWriteFailures.has(onchainMerchantId)) {
      return Promise.reject(new Error(`stub chain: setFeeBps(${onchainMerchantId}) reverted`))
    }
    const hash = this.record('setMerchantFeeBps', [onchainMerchantId, feeBps])
    const current = this.registryFees.get(onchainMerchantId) ?? this.registryFeeDefault
    if (feeBps > current) {
      this.pendingFees.set(onchainMerchantId, { feeBps, effectiveAt: this.chainNow + 86_400n })
    } else {
      this.pendingFees.delete(onchainMerchantId)
      this.registryFees.set(onchainMerchantId, feeBps)
    }
    return Promise.resolve(hash)
  }
  readPendingFee(onchainMerchantId: bigint): Promise<{ feeBps: number; effectiveAt: bigint }> {
    return Promise.resolve(
      this.pendingFees.get(onchainMerchantId) ?? { feeBps: 0, effectiveAt: 0n },
    )
  }
  commitMerchantFeeBps(onchainMerchantId: bigint): Promise<`0x${string}`> {
    const pending = this.pendingFees.get(onchainMerchantId)
    if (!pending) return Promise.reject(new Error('stub chain: Registry__NoPendingFeeChange'))
    if (this.chainNow < pending.effectiveAt) {
      return Promise.reject(new Error('stub chain: Registry__FeeChangeNotDue'))
    }
    const hash = this.record('commitMerchantFeeBps', [onchainMerchantId])
    this.pendingFees.delete(onchainMerchantId)
    this.registryFees.set(onchainMerchantId, pending.feeBps)
    return Promise.resolve(hash)
  }
  latestBlockTimestamp(): Promise<bigint> {
    return Promise.resolve(this.chainNow)
  }

  callsFor(fn: string) {
    return this.calls.filter((c) => c.fn === fn)
  }
}
