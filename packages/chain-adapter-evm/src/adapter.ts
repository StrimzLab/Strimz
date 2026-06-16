/**
 * EvmChainAdapter — the EVM family implementation of `ChainAdapter`.
 *
 * Behaviour-stable surface for M2:
 *   - Identity (`chainId`, `family`, `capabilities`)
 *   - Address validation + canonicalisation
 *
 * Submission methods (`preparePayment`, `chargeSubscription`, `refund`,
 * `subscribeEvents`) throw `AdapterNotImplementedError` until the M2+
 * milestones move the corresponding logic out of `apps/api/src/modules/
 * relay/` into this package.
 *
 * The deliberate "throw, don't no-op" stance keeps the port honest —
 * a caller wiring in an unimplemented method during the transition
 * sees a structured `adapter_not_implemented` error rather than a
 * silent return that pretends the call landed.
 */

import {
  AdapterNotImplementedError,
  InvalidAddressError,
  type ChainAdapter,
  type ChainCapabilities,
  type ChainEventHandlers,
  type ChainFamily,
  type ChargeSubscriptionInput,
  type PreparePaymentInput,
  type PreparePaymentResult,
  type PrepareEnrolmentInput,
  type PrepareEnrolmentResult,
  type RefundInput,
  type RelaySubmission,
  type SignedEnrolmentBundle,
  type SignedPaymentBundle,
  type Unsubscribe,
} from '@strimz/chain-adapter'

import { checksumEvmAddress, isValidEvmAddress } from './address.js'
import { EVM_CAPABILITIES } from './capabilities.js'
import type { EvmChainConfig } from './config.js'

export class EvmChainAdapter implements ChainAdapter {
  readonly family: ChainFamily = 'evm'
  readonly capabilities: ChainCapabilities = EVM_CAPABILITIES

  constructor(private readonly config: EvmChainConfig) {}

  get chainId(): string {
    return this.config.chainId
  }

  // ---------- Addresses ----------

  validateAddress(address: string): boolean {
    return isValidEvmAddress(address)
  }

  normaliseAddress(address: string): string {
    if (!isValidEvmAddress(address)) {
      throw new InvalidAddressError(this.chainId, address)
    }
    return checksumEvmAddress(address)
  }

  // ---------- One-shot payments ----------

  preparePayment(_input: PreparePaymentInput): Promise<PreparePaymentResult> {
    throw new AdapterNotImplementedError(this.chainId, 'preparePayment')
  }

  submitPayment(_bundle: SignedPaymentBundle): Promise<RelaySubmission> {
    throw new AdapterNotImplementedError(this.chainId, 'submitPayment')
  }

  // ---------- Subscriptions ----------

  prepareSubscriptionEnrolment(_input: PrepareEnrolmentInput): Promise<PrepareEnrolmentResult> {
    throw new AdapterNotImplementedError(this.chainId, 'prepareSubscriptionEnrolment')
  }

  submitSubscriptionEnrolment(_bundle: SignedEnrolmentBundle): Promise<RelaySubmission> {
    throw new AdapterNotImplementedError(this.chainId, 'submitSubscriptionEnrolment')
  }

  chargeSubscription(_input: ChargeSubscriptionInput): Promise<RelaySubmission> {
    throw new AdapterNotImplementedError(this.chainId, 'chargeSubscription')
  }

  // ---------- Refunds ----------

  refund(_input: RefundInput): Promise<RelaySubmission> {
    throw new AdapterNotImplementedError(this.chainId, 'refund')
  }

  // ---------- Indexer ----------

  subscribeEvents(_handlers: ChainEventHandlers): Promise<Unsubscribe> {
    throw new AdapterNotImplementedError(this.chainId, 'subscribeEvents')
  }
}
