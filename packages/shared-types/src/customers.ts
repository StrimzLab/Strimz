/**
 * Customer — the payer on the merchant's side.
 *
 * Customers are uniquely identified by (merchantId, walletAddress). Email and
 * externalRef are optional; merchants can associate their own customer id.
 */

import { z } from 'zod'
import {
  emailSchema,
  evmAddressSchema,
  idSchema,
  isoTimestampSchema,
  metadataSchema,
} from './common.js'

export const customerSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  walletAddress: evmAddressSchema,
  email: emailSchema.nullable(),
  /** Merchant-provided external identifier (e.g. their own user id). */
  externalRef: z.string().min(1).max(120).nullable(),
  displayName: z.string().min(1).max(120).nullable(),
  metadata: metadataSchema,
  firstSeenAt: isoTimestampSchema,
  lastSeenAt: isoTimestampSchema,
})
export type Customer = z.infer<typeof customerSchema>

// ---------- DTOs ----------

export const upsertCustomerInputSchema = z.object({
  walletAddress: evmAddressSchema,
  email: emailSchema.optional(),
  externalRef: z.string().min(1).max(120).optional(),
  displayName: z.string().min(1).max(120).optional(),
  metadata: metadataSchema.optional(),
})
export type UpsertCustomerInput = z.infer<typeof upsertCustomerInputSchema>
