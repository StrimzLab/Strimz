import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

/**
 * Zod schemas + DTO classes for the relay HTTP surface.
 *
 * Wire-format rules:
 *  - All bigint-valued fields arrive as decimal strings (JSON has no
 *    bigint native). The schemas `.transform()` them into real bigints
 *    so service code never has to re-parse.
 *  - Addresses are validated as 20-byte hex. Bytes32 fields are
 *    validated as 32-byte hex.
 *  - `v` is constrained to {27, 28} — the canonical Ethereum
 *    parity-byte values that both StrimzPayments and StrimzSubscriptions
 *    expect (the contracts reject anything else via ecrecover).
 *  - `idempotencyKey` caps at 128 chars: the BullMQ job id length limit
 *    we settled on, plus headroom for prefixed scopes like
 *    `ses_<ulid>`.
 */

// ---- shared primitives ----

const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/u, 'must be a 0x-prefixed 20-byte address')

const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/u, 'must be a 0x-prefixed 32-byte hex')

const bigintStringSchema = z
  .string()
  .regex(/^[0-9]+$/u, 'must be a non-negative decimal integer string')
  .transform((s) => BigInt(s))

const vrsSignatureSchema = z.object({
  v: z
    .number()
    .int()
    .refine((v) => v === 27 || v === 28, 'must be 27 or 28'),
  r: bytes32Schema,
  s: bytes32Schema,
})

const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(128, 'idempotency key may not exceed 128 chars')
  // Disallow whitespace / control characters — these are used as BullMQ
  // job ids and end up in Redis keys.
  .regex(/^[A-Za-z0-9_.:-]+$/u, 'idempotency key must be url-safe ASCII')

// ---- POST /v1/relay/payments ----

const payAuthorizationSchema = z.object({
  from: addressSchema,
  amount: bigintStringSchema,
  validAfter: bigintStringSchema,
  validBefore: bigintStringSchema,
  nonce: bytes32Schema,
})

export const submitPaymentInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  /** On-chain merchant id from the StrimzRegistry (uint96). */
  merchantId: bigintStringSchema,
  token: addressSchema,
  auth: payAuthorizationSchema,
  /** Off-chain reference (bytes32) — typically `keccak256(sessionId)`. */
  ref: bytes32Schema,
  signature: vrsSignatureSchema,
  /** Diagnostic only — surfaces in operator dashboards. */
  sessionId: z.string().min(1).max(80).optional(),
})

export class SubmitPaymentDto extends createZodDto(submitPaymentInputSchema) {}

// ---- POST /v1/relay/subscriptions ----

const permitDataSchema = z.object({
  owner: addressSchema,
  value: bigintStringSchema,
  deadline: bigintStringSchema,
})

export const submitSubscriptionInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  merchantId: bigintStringSchema,
  token: addressSchema,
  amount: bigintStringSchema,
  /** Seconds between charges (uint32). */
  interval: z.number().int().positive(),
  /** Unix seconds of first charge; 0 = "now". */
  startAt: bigintStringSchema,
  /** Unix seconds after which charges stop; 0 = open-ended. */
  endAt: bigintStringSchema,
  permitData: permitDataSchema,
  signature: vrsSignatureSchema,
  subscriptionInternalId: z.string().min(1).max(80).optional(),
})

export class SubmitSubscriptionDto extends createZodDto(submitSubscriptionInputSchema) {}
