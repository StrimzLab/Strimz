import type {
  StatsForecast,
  StatsLtv,
  StatsLtvQuery,
  StatsMrr,
  StatsSummary,
  StatsVolume,
} from '@strimz/shared-types'
import type { MerchantApiClient } from '../client'
import type { CallOptions, Page } from '../types'

/**
 * Analytics endpoints. The wire shapes don't exist as Zod-inferred
 * types in @strimz/shared-types (the analytics module uses raw SQL
 * aggregations), so we define interfaces here that mirror the service
 * return values.
 */

export interface ConversionPoint {
  day: string // ISO date
  created: number
  confirmed: number
  /** Confirmed / created, 0..1. */
  rate: number
}

export interface ConversionResponse {
  /** ISO timestamps bounding the response window. */
  from: string
  to: string
  data: ConversionPoint[]
}

export interface ChurnPoint {
  month: string // ISO date for the month start
  cancelled: number
  total: number
  /** Cancelled / total, 0..1. */
  rate: number
}

export interface ChurnResponse {
  from: string
  to: string
  data: ChurnPoint[]
}

export interface MrrResponse {
  /** 6-decimal raw integer string, USDC. */
  mrr: string
  activeSubscribers: number
}

export interface LtvRow {
  customerId: string
  /** 6-decimal raw integer string */
  totalSpend: string
  transactionCount: number
}

export interface LtvResponse extends Page<LtvRow> {}

export interface ForecastResponse {
  confidence: 'low' | 'medium' | 'high'
  /** 6-decimal raw integer string */
  last90DayRevenue: string
  next30: string
  next60: string
  next90: string
}

export interface DateRange {
  from?: string
  to?: string
}

export class AnalyticsResource {
  constructor(private readonly client: MerchantApiClient) {}

  conversion(range: DateRange = {}, options?: CallOptions): Promise<ConversionResponse> {
    return this.client.get<ConversionResponse>('/v1/stats/conversion', {
      ...options,
      query: { from: range.from, to: range.to },
    })
  }

  churn(range: DateRange = {}, options?: CallOptions): Promise<ChurnResponse> {
    return this.client.get<ChurnResponse>('/v1/stats/churn', {
      ...options,
      query: { from: range.from, to: range.to },
    })
  }

  mrr(options?: CallOptions): Promise<StatsMrr> {
    return this.client.get<StatsMrr>('/v1/stats/mrr', options)
  }

  ltv(params: StatsLtvQuery, options?: CallOptions): Promise<StatsLtv> {
    return this.client.get<StatsLtv>('/v1/stats/ltv', {
      ...options,
      query: { currency: params.currency, cursor: params.cursor, limit: params.limit },
    })
  }

  forecast(options?: CallOptions): Promise<StatsForecast> {
    return this.client.get<StatsForecast>('/v1/stats/forecast', options)
  }

  summary(options?: CallOptions): Promise<StatsSummary> {
    return this.client.get<StatsSummary>('/v1/stats/summary', options)
  }

  volume(range: DateRange = {}, options?: CallOptions): Promise<StatsVolume> {
    return this.client.get<StatsVolume>('/v1/stats/volume', {
      ...options,
      query: { from: range.from, to: range.to },
    })
  }
}
