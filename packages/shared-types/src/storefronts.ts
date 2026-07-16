/**
 * Storefronts. Hosted product catalog with checkout baked in.
 */

import { z } from 'zod'
import {
  httpsUrlSchema,
  idSchema,
  isoTimestampSchema,
  paymentCurrencySchema,
  tokenAmountSchema,
} from './common.js'
import { subscriptionIntervalSchema } from './subscriptions.js'

export const storefrontStatusSchema = z.enum(['draft', 'published', 'archived'])
export type StorefrontStatus = z.infer<typeof storefrontStatusSchema>

export const storefrontSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).nullable(),
  logoUrl: httpsUrlSchema.nullable(),
  coverImageUrl: httpsUrlSchema.nullable(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  socialLinks: z.array(httpsUrlSchema).max(10).default([]),
  status: storefrontStatusSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
export type Storefront = z.infer<typeof storefrontSchema>

export const createStorefrontInputSchema = storefrontSchema.pick({
  slug: true,
  name: true,
  description: true,
  logoUrl: true,
  coverImageUrl: true,
  accentColor: true,
  socialLinks: true,
})
export type CreateStorefrontInput = z.infer<typeof createStorefrontInputSchema>

// ---------- Products ----------

export const storefrontProductTypeSchema = z.enum(['one_time', 'subscription'])
export type StorefrontProductType = z.infer<typeof storefrontProductTypeSchema>

export const storefrontProductSchema = z.object({
  id: idSchema,
  storefrontId: idSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable(),
  imageUrl: httpsUrlSchema.nullable(),
  price: tokenAmountSchema,
  currency: paymentCurrencySchema,
  type: storefrontProductTypeSchema,
  interval: subscriptionIntervalSchema.nullable(),
  intervalCount: z.number().int().min(1).max(365).nullable(),
  /** null = unlimited stock. */
  stock: z.number().int().min(0).nullable(),
  planId: idSchema.nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().nonnegative().default(0),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
export type StorefrontProduct = z.infer<typeof storefrontProductSchema>

export const createStorefrontProductInputSchema = storefrontProductSchema
  .omit({
    id: true,
    storefrontId: true,
    planId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    imageUrl: httpsUrlSchema.optional(),
  })
export type CreateStorefrontProductInput = z.infer<typeof createStorefrontProductInputSchema>

/**
 * Payload for the public `/store/:slug/products/:id/checkout` endpoint.
 * Optional customer email flows through into the payment session so
 * the receipt lands in the buyer's inbox after the tx confirms.
 * `returnPath` is used to synthesise the success + cancel URLs when
 * the merchant hasn't wired their own.
 */
export const storefrontCheckoutInputSchema = z.object({
  customerEmail: z.string().email().optional(),
  returnPath: z.string().max(200).optional(),
})
export type StorefrontCheckoutInput = z.infer<typeof storefrontCheckoutInputSchema>

/** Response shape from the public product-checkout endpoint. */
export const storefrontCheckoutResponseSchema = z.object({
  /** Fully-qualified checkout URL — payer redirects here to sign. */
  checkoutUrl: z.string().url(),
  /** Payment-session id (one-time) or plan id (subscription). */
  ref: idSchema,
  /** Which downstream checkout the URL points at. */
  kind: z.enum(['payment_session', 'subscription_plan']),
})
export type StorefrontCheckoutResponse = z.infer<typeof storefrontCheckoutResponseSchema>
