import { z } from 'zod'
import {
  idSchema,
  isoTimestampSchema,
  modeSchema,
  paymentCurrencySchema,
  tokenAmountSchema,
  uintSchema,
  type PaymentCurrency,
} from './common.js'
import { invoiceStatusSchema } from './invoices.js'
import { paymentSessionStatusSchema } from './payment-sessions.js'
import { refundStatusSchema } from './refunds.js'
import { subscriptionStatusSchema } from './subscriptions.js'

export const paymentCurrencies = paymentCurrencySchema.options

const currencyAmountsShape = {
  USDC: tokenAmountSchema,
  EURC: tokenAmountSchema,
} satisfies Record<PaymentCurrency, typeof tokenAmountSchema>

export const currencyAmountsSchema = z.object(currencyAmountsShape).strict()
export type CurrencyAmounts = z.infer<typeof currencyAmountsSchema>

function countsByStatusSchema<T extends [string, ...string[]]>(statuses: z.ZodEnum<T>) {
  const shape = Object.fromEntries(statuses.options.map((s) => [s, uintSchema])) as {
    [K in T[number]]: typeof uintSchema
  }
  return z.object(shape).strict()
}

export const moneySchema = z.object({
  count: uintSchema,
  amount: currencyAmountsSchema,
})
export type Money = z.infer<typeof moneySchema>

export const volumeWindowSchema = z.object({
  count: uintSchema,
  gross: currencyAmountsSchema,
  fees: currencyAmountsSchema,
  net: currencyAmountsSchema,
})
export type VolumeWindow = z.infer<typeof volumeWindowSchema>

export const statsSummarySchema = z.object({
  mode: modeSchema,
  generatedAt: isoTimestampSchema,
  volume: z.object({
    last7d: volumeWindowSchema,
    last30d: volumeWindowSchema,
    allTime: volumeWindowSchema,
  }),
  paymentSessions: z.object({
    total: uintSchema,
    byStatus: countsByStatusSchema(paymentSessionStatusSchema),
    confirmed: moneySchema,
  }),
  invoices: z.object({
    byStatus: countsByStatusSchema(invoiceStatusSchema),
    outstanding: moneySchema,
    overdue: moneySchema,
    paidLast30d: moneySchema,
  }),
  refunds: z.object({
    byStatus: countsByStatusSchema(refundStatusSchema),
    completed: moneySchema,
  }),
  subscriptions: z.object({
    total: uintSchema,
    byStatus: countsByStatusSchema(subscriptionStatusSchema),
  }),
  customers: z.object({
    total: uintSchema,
  }),
})
export type StatsSummary = z.infer<typeof statsSummarySchema>

export const STATS_VOLUME_MAX_DAYS = 366
export const STATS_VOLUME_DEFAULT_DAYS = 30

export function resolveStatsVolumeRange(
  query: { from?: string; to?: string },
  now: number = Date.now(),
): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : new Date(now)
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - STATS_VOLUME_DEFAULT_DAYS * 86_400_000)
  return { from, to }
}

export const statsVolumeQuerySchema = z
  .object({
    from: isoTimestampSchema.optional(),
    to: isoTimestampSchema.optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    const { from, to } = resolveStatsVolumeRange(q)
    if (from.getTime() > to.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from must not be after to',
        path: ['from'],
      })
    } else if (to.getTime() - from.getTime() > STATS_VOLUME_MAX_DAYS * 86_400_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `from and to must be at most ${STATS_VOLUME_MAX_DAYS} days apart`,
        path: ['to'],
      })
    }
  })
export type StatsVolumeQuery = z.infer<typeof statsVolumeQuerySchema>

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD day')

export const statsVolumeDaySchema = z.object({
  day: dayKeySchema,
  currency: paymentCurrencySchema,
  count: uintSchema,
  gross: tokenAmountSchema,
  fees: tokenAmountSchema,
  net: tokenAmountSchema,
})
export type StatsVolumeDay = z.infer<typeof statsVolumeDaySchema>

export const statsVolumeSchema = z.object({
  from: isoTimestampSchema,
  to: isoTimestampSchema,
  data: z.array(statsVolumeDaySchema),
})
export type StatsVolume = z.infer<typeof statsVolumeSchema>

export const statsMrrSchema = z.object({
  mrr: currencyAmountsSchema,
  activeSubscribers: uintSchema,
})
export type StatsMrr = z.infer<typeof statsMrrSchema>

export const statsLtvQuerySchema = z
  .object({
    currency: paymentCurrencySchema,
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().min(1).max(200).optional(),
  })
  .strict()
export type StatsLtvQuery = z.input<typeof statsLtvQuerySchema>
export type StatsLtvQueryParsed = z.output<typeof statsLtvQuerySchema>

export const statsLtvRowSchema = z.object({
  customerId: idSchema,
  totalSpend: tokenAmountSchema,
  transactionCount: uintSchema,
})
export type StatsLtvRow = z.infer<typeof statsLtvRowSchema>

export const statsLtvSchema = z.object({
  currency: paymentCurrencySchema,
  data: z.array(statsLtvRowSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
})
export type StatsLtv = z.infer<typeof statsLtvSchema>

export const forecastConfidenceSchema = z.enum(['low', 'medium', 'high'])
export type ForecastConfidence = z.infer<typeof forecastConfidenceSchema>

export const forecastSchema = z.object({
  confidence: forecastConfidenceSchema,
  last90DayRevenue: tokenAmountSchema,
  next30: tokenAmountSchema,
  next60: tokenAmountSchema,
  next90: tokenAmountSchema,
})
export type Forecast = z.infer<typeof forecastSchema>

const forecastByCurrencyShape = {
  USDC: forecastSchema,
  EURC: forecastSchema,
} satisfies Record<PaymentCurrency, typeof forecastSchema>

export const statsForecastSchema = z.object({
  byCurrency: z.object(forecastByCurrencyShape).strict(),
})
export type StatsForecast = z.infer<typeof statsForecastSchema>

export const adminStatsModeQuerySchema = z
  .object({
    mode: modeSchema.default('live'),
  })
  .strict()
export type AdminStatsModeQuery = z.input<typeof adminStatsModeQuerySchema>

export const adminOverviewSchema = z.object({
  mode: modeSchema,
  merchants: z.object({
    total: uintSchema,
    byStatus: z.record(z.string(), uintSchema),
    last30dSignups: uintSchema,
  }),
  volume: z.object({
    lifetime: currencyAmountsSchema,
    lifetimeFees: currencyAmountsSchema,
    last30d: currencyAmountsSchema,
    confirmedSessions: uintSchema,
  }),
  subscriptions: z.object({
    active: uintSchema,
    mrr: currencyAmountsSchema,
  }),
})
export type AdminOverview = z.infer<typeof adminOverviewSchema>

export const adminMerchantStatsSchema = z.object({
  mode: modeSchema,
  confirmedPayments: uintSchema,
  activeSubscriptions: uintSchema,
  lifetimeVolume: currencyAmountsSchema,
  last30dVolume: currencyAmountsSchema,
})
export type AdminMerchantStats = z.infer<typeof adminMerchantStatsSchema>

export const adminVolumeQuerySchema = z
  .object({
    from: isoTimestampSchema.optional(),
    to: isoTimestampSchema.optional(),
    mode: modeSchema.default('live'),
  })
  .strict()
export type AdminVolumeQuery = z.input<typeof adminVolumeQuerySchema>

export const adminVolumeDaySchema = z.object({
  day: dayKeySchema,
  currency: paymentCurrencySchema,
  volume: tokenAmountSchema,
  fees: tokenAmountSchema,
  count: uintSchema,
})
export type AdminVolumeDay = z.infer<typeof adminVolumeDaySchema>

export const adminVolumeSeriesSchema = z.object({
  mode: modeSchema,
  from: isoTimestampSchema,
  to: isoTimestampSchema,
  data: z.array(adminVolumeDaySchema),
})
export type AdminVolumeSeries = z.infer<typeof adminVolumeSeriesSchema>

export const adminTopMerchantsQuerySchema = z
  .object({
    currency: paymentCurrencySchema,
    mode: modeSchema.default('live'),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict()
export type AdminTopMerchantsQuery = z.input<typeof adminTopMerchantsQuerySchema>

export const adminTopMerchantSchema = z.object({
  merchantId: idSchema,
  businessName: z.string().nullable(),
  email: z.string(),
  volume: tokenAmountSchema,
  transactionCount: uintSchema,
})
export type AdminTopMerchant = z.infer<typeof adminTopMerchantSchema>

export const adminTopMerchantsSchema = z.object({
  mode: modeSchema,
  currency: paymentCurrencySchema,
  data: z.array(adminTopMerchantSchema),
})
export type AdminTopMerchants = z.infer<typeof adminTopMerchantsSchema>
