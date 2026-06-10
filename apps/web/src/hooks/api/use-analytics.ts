'use client'

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'

import type {
  ChurnResponse,
  ConversionResponse,
  DateRange,
  ForecastResponse,
  LtvResponse,
  MrrResponse,
} from '@/lib/merchant-api/resources/analytics'
import type { PaginationParams } from '@/lib/merchant-api'

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

type MrrOptions<TData = MrrResponse> = Omit<
  UseQueryOptions<MrrResponse, Error, TData, ReturnType<typeof analyticsKeys.mrr>>,
  'queryKey' | 'queryFn'
>

type LtvOptions<TData = LtvResponse> = Omit<
  UseQueryOptions<LtvResponse, Error, TData, ReturnType<typeof analyticsKeys.ltv>>,
  'queryKey' | 'queryFn'
>

type ForecastOptions<TData = ForecastResponse> = Omit<
  UseQueryOptions<ForecastResponse, Error, TData, ReturnType<typeof analyticsKeys.forecast>>,
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

export function useMrr<TData = MrrResponse>(options?: MrrOptions<TData>) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: analyticsKeys.mrr(),
    queryFn: ({ signal }) => api.analytics.mrr({ signal }),
    staleTime: LONG_STALE_TIME,
    ...options,
  })
}

export function useLtv<TData = LtvResponse>(
  params: PaginationParams = {},
  options?: LtvOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: analyticsKeys.ltv(params),
    queryFn: ({ signal }) => api.analytics.ltv(params, { signal }),
    staleTime: LONG_STALE_TIME,
    ...options,
  })
}

export function useForecast<TData = ForecastResponse>(options?: ForecastOptions<TData>) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: analyticsKeys.forecast(),
    queryFn: ({ signal }) => api.analytics.forecast({ signal }),
    staleTime: LONG_STALE_TIME,
    ...options,
  })
}
