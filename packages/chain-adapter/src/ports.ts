/**
 * The chain-adapter port.
 *
 * Every Strimz chain implementation conforms to this interface. The
 * business layer (apps/api services, apps/scheduler workers, apps/agent
 * capabilities) calls into it via the `ChainAdapterRegistry` keyed on
 * the session/subscription/transaction's `chain` field.
 *
 * Method surface is at the **business-operation** layer (prepare a
 * payment, charge a subscription, refund a transaction) — not the
 * chain-primitive layer (sign EIP-712 typed data, build a Stellar
 * payment op). That's deliberate: it lets EVM and Stellar implement the
 * same surface even though their primitives diverge sharply.
 *
 * Methods that the v1 EVM adapter doesn't need yet are still defined
 * on the port — concrete adapters throw `AdapterNotImplementedError`
 * until their respective milestone lands. This way the port is the
 * truth from day one; adapters fill in over time without interface
 * churn.
 */

import type { ChainCapabilities } from './capabilities.js'
import type {
  PreparePaymentResult,
  PrepareEnrolmentResult,
  SignedPaymentBundle,
  SignedEnrolmentBundle,
} from './envelopes.js'
import type { ChainFamily, ChainId, RelaySubmission } from './types.js'

// ---------- Input shapes ----------

export interface PreparePaymentInput {
  /** Merchant the funds settle to. */
  merchantId: string
  /** Idempotency key carried through to the relayer. */
  idempotencyKey: string
  /** Currency the session is denominated in. */
  currency: 'USDC' | 'EURC'
  /** Smallest-unit integer (string for bigint safety). */
  amount: string
  /** Payer wallet address — chain-specific shape. */
  payerAddress: string
  /** Free-form reference for the indexer to project later. */
  ref: string
}

export interface PrepareEnrolmentInput {
  merchantId: string
  idempotencyKey: string
  planId: string
  customerId: string
  currency: 'USDC' | 'EURC'
  /** Amount per period. */
  amount: string
  intervalSeconds: number
  payerAddress: string
  /** Optional end-time epoch seconds; null = open-ended. */
  endAt: number | null
}

export interface ChargeSubscriptionInput {
  subscriptionId: string
  idempotencyKey: string
  /** Period end timestamp — used to derive the deterministic charge id. */
  periodEndAt: string
  amount: string
}

export interface RefundInput {
  refundId: string
  idempotencyKey: string
  /** The originating transaction's on-chain hash. */
  originatingTxHash: string
  /** Target address — defaults to original payer when null. */
  toAddress: string | null
  amount: string
  /** Optional free-form reason logged on-chain or off, adapter-specific. */
  reason: string | null
}

export interface RefreshAllowanceInput {
  subscriptionId: string
  idempotencyKey: string
}

/**
 * Indexer event handlers passed to `subscribeEvents`. Each handler
 * receives an opaque per-chain event object — the adapter narrows it
 * before invoking. Handlers are call-once-then-acknowledge; the
 * adapter persists cursor state.
 */
export interface ChainEventHandlers {
  onPaymentConfirmed?: (event: unknown) => Promise<void>
  onSubscriptionEnrolled?: (event: unknown) => Promise<void>
  onSubscriptionCharged?: (event: unknown) => Promise<void>
  onRefundCompleted?: (event: unknown) => Promise<void>
}

/** Returned by `subscribeEvents`; call to detach the handlers. */
export type Unsubscribe = () => Promise<void>

// ---------- The port ----------

export interface ChainAdapter {
  /** Dispatch key — matches the `chain` columns persisted in Postgres. */
  readonly chainId: ChainId
  /** Coarse classification — drives feature-detection in business code. */
  readonly family: ChainFamily
  /** Declarative feature flags; stable for the adapter's lifetime. */
  readonly capabilities: ChainCapabilities

  // ---------- Addresses ----------

  /**
   * Returns true when `address` is a syntactically valid address on
   * this chain. Stateless; doesn't touch the network.
   */
  validateAddress(address: string): boolean

  /**
   * Returns the canonical form of an address (e.g. lowercased EVM hex,
   * Strkey-checksummed Stellar). Throws `InvalidAddressError` on bad
   * input; pair with `validateAddress` for non-throwing checks.
   */
  normaliseAddress(address: string): string

  // ---------- One-shot payments ----------

  /**
   * Builds a chain-specific envelope the payer's wallet signs. Doesn't
   * touch the chain — pure construction.
   */
  preparePayment(input: PreparePaymentInput): Promise<PreparePaymentResult>

  /**
   * Submits a signed envelope to the chain's relayer, returns a
   * tracking handle. Idempotent on `idempotencyKey`.
   */
  submitPayment(bundle: SignedPaymentBundle): Promise<RelaySubmission>

  // ---------- Subscriptions ----------

  /** Mirror of `preparePayment` for subscription enrolment. */
  prepareSubscriptionEnrolment(input: PrepareEnrolmentInput): Promise<PrepareEnrolmentResult>

  /** Mirror of `submitPayment` for subscription enrolment. */
  submitSubscriptionEnrolment(bundle: SignedEnrolmentBundle): Promise<RelaySubmission>

  /**
   * Pulls a recurring charge. Called by the scheduler. Idempotent on
   * `idempotencyKey` (which is also reflected on-chain via the
   * deterministic charge id).
   */
  chargeSubscription(input: ChargeSubscriptionInput): Promise<RelaySubmission>

  // ---------- Refunds ----------

  /**
   * Pushes funds back to the payer (or merchant-supplied address).
   * The merchant signs; no payer signature required.
   */
  refund(input: RefundInput): Promise<RelaySubmission>

  // ---------- Indexer ----------

  /**
   * Subscribes the indexer-side projector to chain-native event
   * streams. Returns an unsubscribe handle. The adapter persists
   * cursor state internally.
   */
  subscribeEvents(handlers: ChainEventHandlers): Promise<Unsubscribe>

  // ---------- Optional, family-specific ----------

  /**
   * Stellar-only: refreshes an expiring SEP-41 allowance. EVM
   * implementations either omit (preferred) or no-op.
   */
  refreshAllowance?(input: RefreshAllowanceInput): Promise<RelaySubmission>
}
