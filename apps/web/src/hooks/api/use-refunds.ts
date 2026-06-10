'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type { CreateRefundInput, Refund } from '@strimz/shared-types'

import type { ListRefundsParams } from '@/lib/merchant-api/resources/refunds'
import type { Page } from '@/lib/merchant-api'

import { useMerchantApi } from './merchant-api-context'
import { useMutationWithToast } from './use-mutation-with-toast'
import { paymentSessionKeys, refundKeys, transactionKeys } from './query-keys'

type ListOptions<TData = Page<Refund>> = Omit<
  UseQueryOptions<Page<Refund>, Error, TData, ReturnType<typeof refundKeys.list>>,
  'queryKey' | 'queryFn'
>

type DetailOptions<TData = Refund> = Omit<
  UseQueryOptions<Refund, Error, TData, ReturnType<typeof refundKeys.detail>>,
  'queryKey' | 'queryFn'
>

export function useRefunds<TData = Page<Refund>>(
  params: ListRefundsParams = {},
  options?: ListOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: refundKeys.list(params),
    queryFn: ({ signal }) => api.refunds.list(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useRefund<TData = Refund>(
  id: string | null | undefined,
  options?: DetailOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: refundKeys.detail(id ?? '__unset'),
    queryFn: ({ signal }) => api.refunds.retrieve(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

/**
 * Create a refund. Cascades invalidation into the related payment
 * session (the dashboard surfaces "refunded" badges on payment rows).
 */
export function useCreateRefund() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: CreateRefundInput) => api.refunds.create(input),
    messages: {
      loading: 'Issuing refund…',
      success: (refund) => `Refund of ${refund.amount} ${refund.currency} issued`,
    },
    onSuccess: (created) => {
      qc.setQueryData(refundKeys.detail(created.id), created)
      qc.invalidateQueries({ queryKey: refundKeys.lists() })
      // The originating transaction's refunded-total + downstream
      // payment-session view both shift — flush both axes. We don't
      // know the session id directly (refund references a transaction),
      // so we invalidate the session lists wholesale.
      qc.invalidateQueries({ queryKey: transactionKeys.detail(created.transactionId) })
      qc.invalidateQueries({ queryKey: transactionKeys.lists() })
      qc.invalidateQueries({ queryKey: paymentSessionKeys.lists() })
    },
  })
}
