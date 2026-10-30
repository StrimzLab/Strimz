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
    this.registryFees.set(onchainMerchantId, feeBps)
    return Promise.resolve(hash)
  }

  callsFor(fn: string) {
    return this.calls.filter((c) => c.fn === fn)
  }
}
