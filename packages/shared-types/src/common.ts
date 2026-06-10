/**
 * Primitive schemas shared across every entity.
 * Every higher-level schema builds on these so validation is consistent.
 */

import { z } from 'zod'

/** CUID2 or UUID-style opaque identifier. */
export const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'id must be URL-safe')

/** EVM address. Hex-encoded, 0x-prefixed, 20 bytes. Normalised to lowercase. */
export const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'must be a 0x-prefixed 40-character hex EVM address')
  .transform((v) => v.toLowerCase())

/** EVM transaction hash. 32-byte hex. */
export const evmTxHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'must be a 0x-prefixed 64-character hex EVM transaction hash')

/** Email address, trimmed and lower-cased. */
export const emailSchema = z.string().email().trim().toLowerCase().max(320)

/** HTTPS URL. No http:// allowed outside dev. */
export const httpsUrlSchema = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://'), {
    message: 'must be an https:// URL',
  })

/** URL permitting http and https (dev + prod). */
export const httpUrlSchema = z.string().url()

/**
 * Amount expressed in the token's smallest unit, serialised as a string to
 * preserve precision beyond `Number.MAX_SAFE_INTEGER`. For USDC (6 decimals),
 * 1 USDC is the string "1000000".
 */
export const tokenAmountSchema = z
  .string()
  .regex(/^[0-9]+$/, 'must be a non-negative integer string (base-10)')
  .refine((v) => BigInt(v) >= 0n, 'must be >= 0')

/** Unsigned integer up to 2^53 - 1; validated and returned as number. */
export const uintSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)

/** ISO-8601 timestamp string (`.toISOString()`-compatible). */
export const isoTimestampSchema = z
  .string()
  .datetime({ offset: true, message: 'must be an ISO-8601 timestamp' })

/** Two-letter ISO-3166 country code. */
export const countryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'must be an ISO-3166 alpha-2 country code')

/** Pagination inputs used by every list endpoint. */
export const paginationInputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).max(200).nullish(),
})
export type PaginationInput = z.infer<typeof paginationInputSchema>

/** Pagination envelope used by every list response. */
export const makePaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })

/** Free-form metadata bag the API round-trips for merchants. */
export const metadataSchema = z
  .record(
    z.string().min(1).max(40),
    z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
  )
  .refine((m) => Object.keys(m).length <= 50, 'at most 50 metadata keys')
  .default({})

/** Environment mode carried on every mode-scoped resource. */
export const modeSchema = z.enum(['test', 'live'])
export type Mode = z.infer<typeof modeSchema>

/** Payment token enum. */
export const paymentCurrencySchema = z.enum(['USDC', 'EURC'])
export type PaymentCurrency = z.infer<typeof paymentCurrencySchema>

/** Every display-level currency (payment + treasury). */
export const tokenSymbolSchema = z.enum(['USDC', 'EURC', 'USYC'])
export type TokenSymbol = z.infer<typeof tokenSymbolSchema>

/** Merchant tier enum. */
export const merchantTierSchema = z.enum(['free', 'growth', 'business', 'enterprise'])
export type MerchantTier = z.infer<typeof merchantTierSchema>

/** Arc environment enum. */
export const arcEnvironmentSchema = z.enum(['testnet', 'mainnet'])
export type ArcEnvironment = z.infer<typeof arcEnvironmentSchema>

export type Id = z.infer<typeof idSchema>
export type EvmAddress = z.infer<typeof evmAddressSchema>
export type EvmTxHash = z.infer<typeof evmTxHashSchema>
export type TokenAmount = z.infer<typeof tokenAmountSchema>
export type IsoTimestamp = z.infer<typeof isoTimestampSchema>
export type Metadata = z.infer<typeof metadataSchema>
