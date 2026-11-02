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
 *  - Signatures are `bytes` on chain, so a smart wallet's ERC-1271
 *    signature passes as hex. A `{v, r, s}` object is packed as
 *    r ‖ s ‖ v, with `v` 27 or 28.
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

export const relayMerchantIdSchema = bigintStringSchema

const MAX_SIGNATURE_BYTES = 4096

const vrsSignatureSchema = z
  .object({
    v: z
      .number()
      .int()
      .refine((v) => v === 27 || v === 28, 'must be 27 or 28'),
    r: bytes32Schema,
    s: bytes32Schema,
  })
  .transform(({ v, r, s }) => `${r}${s.slice(2)}${v.toString(16)}` as `0x${string}`)

const hexSignatureSchema = z
  .string()
  .regex(/^0x(?:[0-9a-fA-F]{2})*$/u, 'must be 0x-prefixed hex with whole bytes')
  .refine(
    (sig) => (sig.length - 2) / 2 <= MAX_SIGNATURE_BYTES,
    `may not exceed ${MAX_SIGNATURE_BYTES} bytes`,
  )
  .transform((sig) => sig as `0x${string}`)

const signatureSchema = z.union([hexSignatureSchema, vrsSignatureSchema])

const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(128, 'idempotency key may not exceed 128 chars')
  // Used verbatim as a BullMQ job id, which ends up in a Redis key. BullMQ
  // rejects ':' (its own key separator), so keep it out of the allowed set.
  .regex(/^[A-Za-z0-9_.-]+$/u, 'idempotency key must be url-safe ASCII without ":"')

// ---- POST /v1/relay/payments ----

const payAuthorizationSchema = z.object({
  from: addressSchema,
  amount: bigintStringSchema,
  validAfter: bigintStringSchema,
  validBefore: bigintStringSchema,
  nonce: bytes32Schema,
})

export const submitPaymentInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema.optional(),
  /** On-chain merchant id from the StrimzRegistry (uint96). */
  merchantId: relayMerchantIdSchema,
  token: addressSchema,
  auth: payAuthorizationSchema,
  /** Off-chain reference (bytes32) — typically `keccak256(sessionId)`. */
  ref: bytes32Schema,
  /** EIP-3009 sig — token verifies. */
  authSignature: signatureSchema,
  /** PayIntent sig — contract verifies. Binds routing fields. */
  intentSignature: signatureSchema,
  /** Diagnostic only — surfaces in operator dashboards. */
  sessionId: z.string().min(1).max(80),
})

export class SubmitPaymentDto extends createZodDto(submitPaymentInputSchema) {}

export const checkoutPaymentRelayInputSchema = submitPaymentInputSchema.omit({ sessionId: true })

export class CheckoutPaymentRelayDto extends createZodDto(checkoutPaymentRelayInputSchema) {}

export type PaymentRelayBody = z.output<typeof checkoutPaymentRelayInputSchema>

// ---- POST /v1/relay/subscriptions ----

const permitDataSchema = z.object({
  owner: addressSchema,
  value: bigintStringSchema,
  deadline: bigintStringSchema,
})

export const submitSubscriptionInputSchema = z.object({
  idempotencyKey: idempotencyKeySchema.optional(),
  merchantId: relayMerchantIdSchema,
  token: addressSchema,
  amount: bigintStringSchema,
  /** Seconds between charges (uint32). */
  interval: z.number().int().positive(),
  /** Unix seconds of first charge; 0 = "now". */
  startAt: bigintStringSchema,
  /** Unix seconds after which charges stop; 0 = open-ended. */
  endAt: bigintStringSchema,
  /** subscriptionIntentNonce(planId, payer, the token's permit nonce). */
  nonce: bytes32Schema,
  permitData: permitDataSchema,
  /** EIP-2612 permit sig — token verifies. */
  permitSignature: signatureSchema,
  /** SubscriptionIntent sig — contract verifies. Binds plan params. */
  intentSignature: signatureSchema,
  subscriptionInternalId: z.string().min(1).max(80),
})

export class SubmitSubscriptionDto extends createZodDto(submitSubscriptionInputSchema) {}

export const checkoutEnrolmentRelayInputSchema = submitSubscriptionInputSchema.omit({
  subscriptionInternalId: true,
})

export class CheckoutEnrolmentRelayDto extends createZodDto(checkoutEnrolmentRelayInputSchema) {}

export type EnrolmentRelayBody = z.output<typeof checkoutEnrolmentRelayInputSchema>

export const submissionQuerySchema = z.object({
  sessionId: z.string().min(1).max(80).optional(),
})

export type SubmissionQuery = z.infer<typeof submissionQuerySchema>
