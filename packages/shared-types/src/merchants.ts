/**
 * Merchant entity and lifecycle DTOs.
 *
 * A merchant is the platform's first-class tenant. Merchants have a tier,
 * a payout wallet address, and an on-chain merchantId registered in the
 * StrimzRegistry contract.
 */

import { z } from 'zod'
import {
  emailSchema,
  evmAddressSchema,
  idSchema,
  isoTimestampSchema,
  merchantTierSchema,
  metadataSchema,
} from './common.js'

export const merchantStatusSchema = z.enum(['active', 'suspended', 'closed'])
export type MerchantStatus = z.infer<typeof merchantStatusSchema>

export const merchantRoleSchema = z.enum(['owner', 'admin', 'developer', 'read_only'])
export type MerchantRole = z.infer<typeof merchantRoleSchema>

export const merchantSchema = z.object({
  id: idSchema,
  onchainMerchantId: z.number().int().nonnegative().nullable(),
  businessName: z.string().min(2).max(120),
  email: emailSchema,
  tier: merchantTierSchema,
  status: merchantStatusSchema,
  payoutAddress: evmAddressSchema.nullable(),
  defaultCurrency: z.enum(['USDC', 'EURC']),
  countryCode: z.string().length(2).nullable(),
  websiteUrl: z.string().url().nullable(),
  logoUrl: z.string().url().nullable(),
  whitelabelEnabled: z.boolean(),
  metadata: metadataSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
export type Merchant = z.infer<typeof merchantSchema>

// ---------- DTOs ----------

export const createMerchantInputSchema = z.object({
  businessName: z.string().min(2).max(120),
  email: emailSchema,
  password: z.string().min(12).max(128),
  countryCode: z.string().length(2).optional(),
  websiteUrl: z.string().url().optional(),
})
export type CreateMerchantInput = z.infer<typeof createMerchantInputSchema>

export const updateMerchantInputSchema = z
  .object({
    businessName: z.string().min(2).max(120),
    payoutAddress: evmAddressSchema,
    defaultCurrency: z.enum(['USDC', 'EURC']),
    websiteUrl: z.string().url().nullable(),
    logoUrl: z.string().url().nullable(),
    countryCode: z.string().length(2).nullable(),
    metadata: metadataSchema,
  })
  .partial()
export type UpdateMerchantInput = z.infer<typeof updateMerchantInputSchema>

export const changeTierInputSchema = z.object({
  tier: merchantTierSchema,
})
export type ChangeTierInput = z.infer<typeof changeTierInputSchema>

// ---------- Team members ----------

export const merchantMemberSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  email: emailSchema,
  role: merchantRoleSchema,
  invitedAt: isoTimestampSchema,
  acceptedAt: isoTimestampSchema.nullable(),
})
export type MerchantMember = z.infer<typeof merchantMemberSchema>

export const inviteMemberInputSchema = z.object({
  email: emailSchema,
  role: merchantRoleSchema,
})
export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>

// ---------- Auth ----------

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
})
export type LoginInput = z.infer<typeof loginInputSchema>

export const loginOutputSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  merchant: merchantSchema,
})
export type LoginOutput = z.infer<typeof loginOutputSchema>
