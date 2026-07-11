'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type {
  CreateRefundInput,
  Refund,
  RefundCreateOutput,
  SubmitRefundSignatureInput,
} from '@strimz/shared-types'

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
      loading: 'Preparing refund…',
      success: (out: RefundCreateOutput) =>
        `Refund draft ready. Sign the ${out.refund.currency} transfer to send it.`,
    },
    onSuccess: (out: RefundCreateOutput) => {
      const created = out.refund
      qc.setQueryData(refundKeys.detail(created.id), created)
      qc.invalidateQueries({ queryKey: refundKeys.lists() })
      qc.invalidateQueries({ queryKey: transactionKeys.detail(created.transactionId) })
      qc.invalidateQueries({ queryKey: transactionKeys.lists() })
      qc.invalidateQueries({ queryKey: paymentSessionKeys.lists() })
    },
  })
}

/**
 * Reports the tx hash of the merchant's on-chain refund transfer.
 * Called after `useCreateRefund` succeeds and the Privy embedded
 * wallet has broadcast the ERC-20 transfer.
 */
export function useSubmitRefundSignature() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: SubmitRefundSignatureInput) => api.refunds.submitSignature(input),
    messages: {
      loading: 'Submitting refund…',
      success: (r: Refund) => `Refund ${r.id.slice(0, 8)}… submitted`,
    },
    onSuccess: (updated) => {
      qc.setQueryData(refundKeys.detail(updated.id), updated)
      qc.invalidateQueries({ queryKey: refundKeys.lists() })
      qc.invalidateQueries({ queryKey: transactionKeys.detail(updated.transactionId) })
      qc.invalidateQueries({ queryKey: transactionKeys.lists() })
    },
  })
}
