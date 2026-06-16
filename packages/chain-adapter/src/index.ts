/**
 * @strimz/chain-adapter
 *
 * The chain-agnostic port + runtime registry. Every Strimz chain
 * implementation (EVM, Stellar, …) conforms to `ChainAdapter`; the
 * business layer dispatches via `ChainAdapterRegistry`.
 *
 * This package is framework-free. Concrete adapters bring their own
 * dependencies (viem on EVM, @stellar/stellar-sdk on Stellar).
 */

export type { ChainCapabilities } from './capabilities.js'
export type {
  ChainEnvelope,
  PreparePaymentResult,
  PrepareEnrolmentResult,
  SignedPaymentBundle,
  SignedEnrolmentBundle,
} from './envelopes.js'
export {
  AdapterNotImplementedError,
  ChainAdapterError,
  ChainMismatchError,
  ChainNotFoundError,
  InvalidAddressError,
} from './errors.js'
export type {
  ChainAdapter,
  ChainEventHandlers,
  ChargeSubscriptionInput,
  PreparePaymentInput,
  PrepareEnrolmentInput,
  RefreshAllowanceInput,
  RefundInput,
  Unsubscribe,
} from './ports.js'
export { ChainAdapterRegistry } from './registry.js'
export type { ChainFamily, ChainId, RelaySubmission } from './types.js'
