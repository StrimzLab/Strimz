import type { Hex } from 'viem'

/**
 * EIP-3009 ReceiveWithAuthorization fields the payer signs off-chain.
 * Mirrors the on-chain `PayAuthorization` struct in `IStrimzPayments`.
 */
export interface PayAuthorization {
  from: `0x${string}`
  amount: bigint
  validAfter: bigint
  validBefore: bigint
  nonce: `0x${string}` // bytes32
}

/**
 * EIP-2612 Permit fields the payer signs off-chain. Mirrors the
 * on-chain `PermitData` struct in `IStrimzSubscriptions`.
 */
export interface PermitData {
  owner: `0x${string}`
  value: bigint
  deadline: bigint
}

/**
 * A canonical 65-byte secp256k1 signature decomposed into `v`, `r`, `s`
 * — what both the StrimzPayments and StrimzSubscriptions contracts
 * expect as the three trailing args of the meta-tx entrypoints.
 */
export interface VRSSignature {
  v: number // 27 or 28
  r: `0x${string}` // bytes32
  s: `0x${string}` // bytes32
}

/**
 * Caller-facing inputs for the one-shot EIP-3009 payment path.
 *
 * `idempotencyKey` MUST be stable across retries from the same client
 * intent (e.g. the payment-session id). Duplicate keys return the
 * existing submission rather than creating a second one.
 */
export interface PayWithAuthorizationInput {
  idempotencyKey: string
  merchantId: bigint
  token: `0x${string}`
  auth: PayAuthorization
  ref: `0x${string}` // bytes32 — typically `keccak256(sessionId)`
  signature: VRSSignature
  // Optional diagnostics for the operator dashboard. Not used on-chain.
  merchantInternalId?: string
  sessionId?: string
}

/**
 * Caller-facing inputs for the EIP-2612 subscription enrolment path.
 */
export interface PermitAndCreateSubscriptionInput {
  idempotencyKey: string
  merchantId: bigint
  token: `0x${string}`
  amount: bigint
  interval: number // seconds (uint32)
  startAt: bigint // uint64
  endAt: bigint // uint64, 0 = open-ended
  permitData: PermitData
  signature: VRSSignature
  merchantInternalId?: string
  subscriptionInternalId?: string
}

/**
 * Lifecycle states a submission moves through. Mirrors what BullMQ
 * job state surfaces but in a payments-domain vocabulary.
 *
 *   queued     — accepted, awaiting worker pickup
 *   signing    — worker has the job, fetching nonce + gas, signing
 *   broadcast  — sent to RPC, awaiting on-chain confirmation
 *   confirmed  — receipt with status=success
 *   reverted   — receipt with status=reverted (gas spent, intent failed)
 *   failed     — submission failed before/without reaching the chain
 */
export type RelaySubmissionStatus =
  | 'queued'
  | 'signing'
  | 'broadcast'
  | 'confirmed'
  | 'reverted'
  | 'failed'

/**
 * Public-facing view of a submission. The RelayService returns this
 * shape from both the enqueue and the lookup paths.
 */
export interface RelaySubmissionView {
  id: string
  idempotencyKey: string
  status: RelaySubmissionStatus
  txHash: `0x${string}` | null
  reason: 'payWithAuthorization' | 'permitAndCreateSubscription'
  errorReason: string | null
  attemptCount: number
  enqueuedAt: string
}

/**
 * Internal job payload. Lives in BullMQ; small and self-contained so
 * the worker can hydrate everything it needs from the queue without
 * a second DB read.
 */
export interface RelayJobData {
  idempotencyKey: string
  reason: 'payWithAuthorization' | 'permitAndCreateSubscription'
  toAddress: `0x${string}`
  callData: Hex
  gasLimit: string // serialised bigint
  // Diagnostics for operator surfaces — not used by the worker logic.
  merchantInternalId?: string
  sessionId?: string
  subscriptionInternalId?: string
}
