/**
 * Invoices. Shareable, expirable payment requests with structured line items.
 */

import { z } from 'zod'
import {
  emailSchema,
  idSchema,
  isoTimestampSchema,
  paymentCurrencySchema,
  tokenAmountSchema,
} from './common.js'

export const invoiceStatusSchema = z.enum(['draft', 'sent', 'paid', 'overdue', 'void'])
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).max(10_000),
  unitAmount: tokenAmountSchema,
})
export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>

export const invoiceSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  number: z.string().min(1).max(40),
  customerName: z.string().min(1).max(200).nullable(),
  customerEmail: emailSchema.nullable(),
  lineItems: z.array(invoiceLineItemSchema).nonempty(),
  subtotal: tokenAmountSchema,
  total: tokenAmountSchema,
  currency: paymentCurrencySchema,
  status: invoiceStatusSchema,
  note: z.string().max(2000).nullable(),
  sessionId: idSchema.nullable(),
  dueAt: isoTimestampSchema,
  paidAt: isoTimestampSchema.nullable(),
  sentAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
export type Invoice = z.infer<typeof invoiceSchema>

export const createInvoiceInputSchema = z.object({
  customerName: z.string().min(1).max(200).optional(),
  customerEmail: emailSchema.optional(),
  lineItems: z.array(invoiceLineItemSchema).nonempty(),
  currency: paymentCurrencySchema,
  note: z.string().max(2000).optional(),
  dueInDays: z.number().int().min(1).max(90).default(7),
})
export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>
