'use client'

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'

import type {
  StatsForecast,
  StatsLtv,
  StatsLtvQuery,
  StatsMrr,
  StatsSummary,
  StatsVolume,
} from '@strimz/shared-types'
import type {
  ChurnResponse,
  ConversionResponse,
  DateRange,
} from '@/lib/merchant-api/resources/analytics'

import { useMerchantApi } from './merchant-api-context'
import { analyticsKeys } from './query-keys'

type ConversionOptions<TData = ConversionResponse> = Omit<
  UseQueryOptions<ConversionResponse, Error, TData, ReturnType<typeof analyticsKeys.conversion>>,
  'queryKey' | 'queryFn'
>

type ChurnOptions<TData = ChurnResponse> = Omit<
  UseQueryOptions<ChurnResponse, Error, TData, ReturnType<typeof analyticsKeys.churn>>,
  'queryKey' | 'queryFn'
>

type MrrOptions<TData = StatsMrr> = Omit<
  UseQueryOptions<StatsMrr, Error, TData, ReturnType<typeof analyticsKeys.mrr>>,
  'queryKey' | 'queryFn'
>

type LtvOptions<TData = StatsLtv> = Omit<
  UseQueryOptions<StatsLtv, Error, TData, ReturnType<typeof analyticsKeys.ltv>>,
  'queryKey' | 'queryFn'
>

type ForecastOptions<TData = StatsForecast> = Omit<
  UseQueryOptions<StatsForecast, Error, TData, ReturnType<typeof analyticsKeys.forecast>>,
  'queryKey' | 'queryFn'
>

type SummaryOptions<TData = StatsSummary> = Omit<
  UseQueryOptions<StatsSummary, Error, TData, ReturnType<typeof analyticsKeys.summary>>,
  'queryKey' | 'queryFn'
>

type VolumeOptions<TData = StatsVolume> = Omit<
  UseQueryOptions<StatsVolume, Error, TData, ReturnType<typeof analyticsKeys.volume>>,
  'queryKey' | 'queryFn'
>

/**
 * Analytics queries get a longer staleTime because they're expensive
 * server-side (SQL aggregations over Transaction history) and don't
 * change at sub-minute granularity in any merchant-meaningful way.
 */
const LONG_STALE_TIME = 5 * 60_000

export function useConversion<TData = ConversionResponse>(
  range: DateRange = {},
  options?: ConversionOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: analyticsKeys.conversion(range),
    queryFn: ({ signal }) => api.analytics.conversion(range, { signal }),
    staleTime: LONG_STALE_TIME,
    ...options,
  })
}

export function useChurn<TData = ChurnResponse>(
  range: DateRange = {},
  options?: ChurnOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: analyticsKeys.churn(range),
    queryFn: ({ signal }) => api.analytics.churn(range, { signal }),
    staleTime: LONG_STALE_TIME,
    ...options,
  })
}

export function useMrr<TData = StatsMrr>(options?: MrrOptions<TData>) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: analyticsKeys.mrr(),
    queryFn: ({ signal }) => api.analytics.mrr({ signal }),
    staleTime: LONG_STALE_TIME,
    ...options,
  })
}

export function useLtv<TData = StatsLtv>(params: StatsLtvQuery, options?: LtvOptions<TData>) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: analyticsKeys.ltv(params),
    queryFn: ({ signal }) => api.analytics.ltv(params, { signal }),
    staleTime: LONG_STALE_TIME,
    ...options,
  })
}

export function useForecast<TData = StatsForecast>(options?: ForecastOptions<TData>) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: analyticsKeys.forecast(),
    queryFn: ({ signal }) => api.analytics.forecast({ signal }),
    staleTime: LONG_STALE_TIME,
    ...options,
  })
}

export function useStatsSummary<TData = StatsSummary>(options?: SummaryOptions<TData>) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: analyticsKeys.summary(),
    queryFn: ({ signal }) => api.analytics.summary({ signal }),
    staleTime: LONG_STALE_TIME,
    ...options,
  })
}

export function useStatsVolume<TData = StatsVolume>(
  range: DateRange = {},
  options?: VolumeOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: analyticsKeys.volume(range),
    queryFn: ({ signal }) => api.analytics.volume(range, { signal }),
    staleTime: LONG_STALE_TIME,
    ...options,
  })
}
