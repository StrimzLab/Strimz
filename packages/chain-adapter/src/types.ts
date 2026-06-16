/**
 * Shared primitives for the chain-adapter port. Re-exported from the
 * package root via `index.ts`.
 *
 * Type aliases here mirror the corresponding zod schemas in
 * `@strimz/shared-types/common`. Keep them in sync — the schemas are the
 * runtime source of truth; the types here are compile-time aliases for
 * call sites that don't import zod (the adapter package is deliberately
 * dependency-light).
 */

/**
 * Family of chains that share a common protocol shape.
 *
 * - `evm` — Ethereum-like; ERC-3009, EIP-2612, EIP-712 signing.
 * - `stellar` — Stellar Core + Soroban; fee-bump txs, SEP-41 approve.
 *
 * Adding a new family is rare and is a deliberate architectural
 * decision — it usually requires new ports in `ChainAdapter` to model
 * primitives the existing families don't have.
 */
export type ChainFamily = 'evm' | 'stellar'

/**
 * Stable adapter dispatch key. Format: `<family>:<network>`.
 *
 * Concrete values today: `evm:base`, `evm:arc`, `stellar:pubnet`,
 * `stellar:testnet`. The value appears in Prisma columns, webhook
 * payloads, audit logs, SDK responses — it is a public contract.
 *
 * EVM numeric chain ids + Stellar network passphrases live inside the
 * adapter's `rpcConfig`, not in this string. Renaming a chain after
 * launch is a breaking change for every persisted row.
 */
export type ChainId = string

/**
 * Submission tracking handle returned by every relayer-touching method.
 * Mirrors the existing RelaySubmissionView shape used in apps/api so
 * callers don't have to translate between shapes at boundaries.
 */
export interface RelaySubmission {
  /** Idempotency key the caller supplied; durably keyed across retries. */
  idempotencyKey: string
  /** BullMQ job id when queued; null when the adapter is synchronous. */
  jobId: string | null
  /** Confirmed on-chain tx hash when known. */
  txHash: string | null
  /**
   * Coarse state. Adapter-specific outcomes (e.g. CCTP-attestation-pending
   * for Stellar bridges) live in `metadata`.
   */
  status: 'queued' | 'broadcasting' | 'confirmed' | 'failed'
  /** Wall-clock when the submission was first enqueued. */
  enqueuedAt: string
  /** Free-form structured details from the adapter. */
  metadata: Record<string, unknown>
}
