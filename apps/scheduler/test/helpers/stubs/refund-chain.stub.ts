import { keccak256, toHex, type Address, type Hex } from 'viem'

import type { BroadcastOutcome } from '../../../src/infra/refund-chain/refund-chain.service.js'

/** Replaces the refund wallet: records signatures and broadcasts, never touches a chain. */
export class StubRefundChainService {
  public address: Address | null = '0x00000000000000000000000000000000000000e5'
  public readonly balances = new Map<string, bigint>()
  public readonly signed: {
    token: Address
    to: Address
    amount: bigint
    nonce: number
    txHash: Hex
  }[] = []
  public readonly broadcasts: Hex[] = []
  public readonly receipts = new Map<string, 'success' | 'reverted'>()
  public failNextBroadcast = false
  public pendingNonce = 0
  public minedNonceValue = 0

  tokenBalance(token: Address): Promise<bigint> {
    return Promise.resolve(this.balances.get(token.toLowerCase()) ?? 0n)
  }
  nextNonce(): Promise<number> {
    return Promise.resolve(this.pendingNonce)
  }
  minedNonce(): Promise<number> {
    return Promise.resolve(this.minedNonceValue)
  }
  signTransfer(input: { token: Address; to: Address; amount: bigint; nonce: number }) {
    const signedTx = toHex(`${input.token}:${input.to}:${input.amount}:${input.nonce}`)
    const txHash = keccak256(signedTx)
    this.signed.push({ ...input, txHash })
    return Promise.resolve({ signedTx, txHash })
  }
  broadcast(signedTx: Hex): Promise<BroadcastOutcome> {
    if (this.failNextBroadcast) {
      this.failNextBroadcast = false
      return Promise.reject(new Error('stub refund chain: broadcast failed'))
    }
    this.broadcasts.push(signedTx)
    this.pendingNonce++
    return Promise.resolve('sent')
  }
  receiptStatus(txHash: Hex): Promise<'success' | 'reverted' | null> {
    return Promise.resolve(this.receipts.get(txHash) ?? null)
  }
  reset(): void {
    this.address = '0x00000000000000000000000000000000000000e5'
    this.balances.clear()
    this.signed.length = 0
    this.broadcasts.length = 0
    this.receipts.clear()
    this.failNextBroadcast = false
    this.pendingNonce = 0
    this.minedNonceValue = 0
  }
}
