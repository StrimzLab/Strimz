import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

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

  mrr(options?: CallOptions): Promise<MrrResponse> {
    return this.client.get<MrrResponse>('/v1/stats/mrr', options)
  }

  ltv(params: PaginationParams = {}, options?: CallOptions): Promise<LtvResponse> {
    return this.client.get<LtvResponse>('/v1/stats/ltv', {
      ...options,
      query: { cursor: params.cursor, limit: params.limit },
    })
  }

  forecast(options?: CallOptions): Promise<ForecastResponse> {
    return this.client.get<ForecastResponse>('/v1/stats/forecast', options)
  }
}
