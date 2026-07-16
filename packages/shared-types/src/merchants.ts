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
  /**
   * Merchant's controlling EVM address — the Privy embedded wallet
   * captured at sign-in. Exposed so the dashboard can pre-fill the
   * EVM payout entry at onboarding without a separate Privy round-trip.
   * Distinct from `payoutAddresses['evm:*']`, which can point at a
   * treasury / multisig / external wallet.
   */
  walletAddress: evmAddressSchema.nullable(),
  defaultCurrency: z.enum(['USDC', 'EURC']),
  countryCode: z.string().length(2).nullable(),
  websiteUrl: z.string().url().nullable(),
  logoUrl: z.string().url().nullable(),
  whitelabelEnabled: z.boolean(),
  // Onboarding + security flags drive the dashboard's "Unlock live mode"
  // banner and gate live-key issuance server-side. Exposed in the shared
  // type so the merchant frontend can derive UI from them without a
  // second round-trip.
  onboardingCompleted: z.boolean(),
  twoFactorEnabled: z.boolean(),
  // Chain ids the merchant has opted in to for incoming payments — a
  // subset of currently-enabled SupportedChains. Drives the chain
  // picker on checkout. Empty for legacy rows that pre-date the
  // multi-chain rollout.
  supportedChains: z.array(z.string()),
  // Per-chain payout addresses, keyed by chain id. Shape:
  //   { 'evm:base': '0x…', 'stellar:pubnet': 'G…' | 'C…' }
  // The chain adapter validates the address format against the chain
  // it's mapped to; the shared type treats values as opaque strings.
  payoutAddresses: z.record(z.string(), z.string()),
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

/**
 * Merchant email opt-outs, persisted at `Merchant.metadata.emailPrefs`.
 * Both default to true. Welcome, refunds, and admin broadcasts always send.
 */
export const merchantEmailPrefsSchema = z.object({
  /** "You received X USDC" one-off payment notifications. */
  paymentReceived: z.boolean(),
  /** "You were paid X for subscription Y" per-charge notifications. */
  subscriptionCharged: z.boolean(),
})
export type MerchantEmailPrefs = z.infer<typeof merchantEmailPrefsSchema>

export const DEFAULT_MERCHANT_EMAIL_PREFS: MerchantEmailPrefs = {
  paymentReceived: true,
  subscriptionCharged: true,
}

export const updateMerchantInputSchema = z
  .object({
    businessName: z.string().min(2).max(120),
    payoutAddress: evmAddressSchema,
    defaultCurrency: z.enum(['USDC', 'EURC']),
    websiteUrl: z.string().url().nullable(),
    logoUrl: z.string().url().nullable(),
    countryCode: z.string().length(2).nullable(),
    metadata: metadataSchema,
    emailPrefs: merchantEmailPrefsSchema.partial(),
  })
  .partial()
export type UpdateMerchantInput = z.infer<typeof updateMerchantInputSchema>

export const changeTierInputSchema = z.object({
  tier: merchantTierSchema,
})
export type ChangeTierInput = z.infer<typeof changeTierInputSchema>

/**
 * Self-attested onboarding form the dashboard collects after a
 * merchant first logs in via Privy. On success the API stamps
 * `onboardingCompleted: true` on the row, and the dashboard exits
 * the wizard. Shared here so the API's DTO and the web client's
 * hook can enforce the same shape.
 */
export const onboardMerchantInputSchema = z.object({
  businessName: z.string().min(2).max(120),
  businessSector: z.string().min(2).max(80),
  countryCode: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/, 'must be a 2-letter ISO country code'),
  websiteUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  phone: z.string().min(6).max(20).optional(),
  /**
   * Per-chain payout addresses, keyed by chain id (`evm:base`,
   * `stellar:pubnet`, …). At minimum, one chain must be configured.
   * Address shape validation per chain is delegated to the chain
   * adapter at the API layer — the shared schema only enforces the
   * map structure + non-empty constraint here.
   */
  payoutAddresses: z
    .record(z.string(), z.string().min(1).max(80))
    .refine((map) => Object.keys(map).length > 0, {
      message: 'at least one chain must be configured',
    }),
  defaultCurrency: z.enum(['USDC', 'EURC']).optional(),
})
export type OnboardMerchantInput = z.infer<typeof onboardMerchantInputSchema>

export const merchantPublicBrandSchema = z.object({
  id: idSchema,
  businessName: z.string().min(2).max(120),
  logoUrl: z.string().url().nullable(),
  walletAddress: evmAddressSchema.nullable(),
})
export type MerchantPublicBrand = z.infer<typeof merchantPublicBrandSchema>

/**
 * On-chain balance view for the withdraw page. Strimz is
 * non-custodial: payments settle directly into the merchant's
 * `payoutAddress`, and "withdrawal" means the merchant transferring
 * out with their own wallet. This shape reports current on-chain
 * state so the dashboard renders live balances + decides whether to
 * offer the signing UI.
 */
export const merchantBalanceSchema = z.object({
  /** Payout wallet, checksummed; null when the merchant hasn't set one. */
  payoutAddress: evmAddressSchema.nullable(),
  /** Privy embedded wallet, checksummed if resolvable. */
  walletAddress: evmAddressSchema.nullable(),
  /**
   * True when `payoutAddress === walletAddress`, i.e. the merchant
   * can sign a transfer from the dashboard via Privy. False for
   * merchants using an external wallet as payout — the UI falls back
   * to "copy the address, transfer with your wallet."
   */
  canSignFromDashboard: z.boolean(),
  balances: z.array(
    z.object({
      currency: z.enum(['USDC', 'EURC']),
      contractAddress: evmAddressSchema,
      /** Base-6 integer as string. */
      raw: z.string(),
      /** Human-formatted, e.g. `1234.56`. */
      formatted: z.string(),
      decimals: z.number().int().min(0).max(30),
    }),
  ),
})
export type MerchantBalanceView = z.infer<typeof merchantBalanceSchema>

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
