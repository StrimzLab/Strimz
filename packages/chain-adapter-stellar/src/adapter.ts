/**
 * `StellarChainAdapter` — the Stellar family implementation of
 * `ChainAdapter`.
 *
 * M5a stable surface:
 *   - Identity (`chainId`, `family`, `capabilities`)
 *   - Strkey-backed address validation + canonicalisation
 *
 * Submission methods (`preparePayment`, `chargeSubscription`,
 * `refund`, `subscribeEvents`, `refreshAllowance`) throw
 * `AdapterNotImplementedError` until M5b–e land their respective
 * envelope-construction, relayer-submission, indexer, and dunning-lane
 * code. The deliberate "throw, don't no-op" stance matches the EVM
 * adapter's M2-era posture — a caller wiring in an unmoved method
 * during the transition sees a structured `adapter_not_implemented`
 * error rather than a silent return that pretends the call landed.
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
  type RefreshAllowanceInput,
  type RefundInput,
  type RelaySubmission,
  type SignedEnrolmentBundle,
  type SignedPaymentBundle,
  type Unsubscribe,
} from '@strimz/chain-adapter'

import { isValidStellarPayoutAddress, normaliseStellarAddress } from './address.js'
import { STELLAR_CAPABILITIES } from './capabilities.js'
import type { StellarChainConfig } from './config.js'

export class StellarChainAdapter implements ChainAdapter {
  readonly family: ChainFamily = 'stellar'
  readonly capabilities: ChainCapabilities = STELLAR_CAPABILITIES

  constructor(private readonly config: StellarChainConfig) {}

  get chainId(): string {
    return this.config.chainId
  }

  // ---------- Addresses ----------

  validateAddress(address: string): boolean {
    return isValidStellarPayoutAddress(address)
  }

  normaliseAddress(address: string): string {
    try {
      return normaliseStellarAddress(address)
    } catch {
      throw new InvalidAddressError(this.chainId, address)
    }
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

  // ---------- Stellar-specific ----------

  refreshAllowance(_input: RefreshAllowanceInput): Promise<RelaySubmission> {
    throw new AdapterNotImplementedError(this.chainId, 'refreshAllowance')
  }
}
