/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Address } from 'viem'

/**
 * Records every write call without broadcasting. `txHash` defaults to a
 * deterministic synthetic value so callers can assert on it.
 */
export class StubChainService {
  public readonly account = { address: '0x0000000000000000000000000000000000000001' as Address }
  public readonly subscriptionsAddress: Address = '0x0000000000000000000000000000000000000001'
  public readonly agentEscrowAddress: Address = '0x0000000000000000000000000000000000000002'
  public readonly messageTransmitterAddress: Address = '0x000000000000000000000000000000000000cccc'

  public readonly publicClient: any = {}
  public readonly walletClient: any = {}

  public readonly calls: { fn: string; args: unknown[] }[] = []
  public attemptUsedAnswers = new Map<string, boolean>()
  public attemptUsedDefault = false
  public failNext = false

  reset() {
    this.calls.length = 0
    this.attemptUsedAnswers.clear()
    this.attemptUsedDefault = false
    this.failNext = false
  }

  private record(fn: string, args: unknown[]): `0x${string}` {
    if (this.failNext) {
      this.failNext = false
      throw new Error('stub chain: failNext')
    }
    this.calls.push({ fn, args })
    return ('0x' + 'a'.repeat(63) + this.calls.length.toString(16)) as `0x${string}`
  }

  cancelSubscription(subscriptionId: bigint): Promise<`0x${string}`> {
    return Promise.resolve(this.record('cancelSubscription', [subscriptionId]))
  }
  batchCharge(ids: readonly bigint[], attempts: readonly `0x${string}`[]): Promise<`0x${string}`> {
    return Promise.resolve(this.record('batchCharge', [ids, attempts]))
  }
  isAttemptUsed(id: `0x${string}`): Promise<boolean> {
    return Promise.resolve(this.attemptUsedAnswers.get(id) ?? this.attemptUsedDefault)
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

  callsFor(fn: string) {
    return this.calls.filter((c) => c.fn === fn)
  }
}
