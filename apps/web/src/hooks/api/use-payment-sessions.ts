'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type { CreatePaymentSessionInput, PaymentSession } from '@strimz/shared-types'

import type { ListPaymentSessionsParams } from '@/lib/merchant-api/resources/payment-sessions'
import type { Page } from '@/lib/merchant-api'

import { useMerchantApi } from './merchant-api-context'
import { useMutationWithToast } from './use-mutation-with-toast'
import { paymentSessionKeys } from './query-keys'

/**
 * Subset of the standard TanStack Query options we let consumers pass.
 * We hide `queryKey` and `queryFn` so callers can't drift from the
 * factory + client — the whole point of these hooks.
 */
type ListOptions<TData = Page<PaymentSession>> = Omit<
  UseQueryOptions<Page<PaymentSession>, Error, TData, ReturnType<typeof paymentSessionKeys.list>>,
  'queryKey' | 'queryFn'
>

type DetailOptions<TData = PaymentSession> = Omit<
  UseQueryOptions<PaymentSession, Error, TData, ReturnType<typeof paymentSessionKeys.detail>>,
  'queryKey' | 'queryFn'
>

/**
 * List payment sessions. Re-rendering optimisations:
 *
 *   - `placeholderData: keepPreviousData` keeps the prior page mounted
 *     during pagination/filter changes, so the table doesn't flash to
 *     a skeleton between fetches.
 *   - The generic `TData` lets callers pass a `select` to project the
 *     page into a view-model (rows + totals + statusCounts). When the
 *     `select` result is shallow-equal to the previous, TanStack Query
 *     skips the re-render — same caching, far fewer renders.
 */
export function usePaymentSessions<TData = Page<PaymentSession>>(
  params: ListPaymentSessionsParams = {},
  options?: ListOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: paymentSessionKeys.list(params),
    queryFn: ({ signal }) => api.paymentSessions.list(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function usePaymentSession<TData = PaymentSession>(
  id: string | null | undefined,
  options?: DetailOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: paymentSessionKeys.detail(id ?? '__unset'),
    queryFn: ({ signal }) => api.paymentSessions.retrieve(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

/**
 * Create a payment session.
 *
 * On success we both seed the detail cache (so the redirect to the
 * detail page is instant) AND invalidate every list view so freshly
 * mounted tables show the new row. We don't optimistic-update the list
 * because we'd need every active filter combination to know whether
 * the new row belongs — server round-trip is the honest answer.
 */
export function useCreatePaymentSession() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: CreatePaymentSessionInput) => api.paymentSessions.create(input),
    onSuccess: (created) => {
      qc.setQueryData(paymentSessionKeys.detail(created.id), created)
      qc.invalidateQueries({ queryKey: paymentSessionKeys.lists() })
    },
    messages: {
      loading: 'Creating payment session…',
      success: (s) => `Payment session created for ${s.amount} ${s.currency}`,
    },
  })
}

/**
 * Cancel a payment session with an optimistic update.
 *
 * We patch the detail cache + every list cache that already contains
 * the row so the UI reflects the new status in a frame. If the server
 * rejects (race, already-confirmed, etc.) the `onError` rollback
 * restores the prior snapshot.
 */
export function useCancelPaymentSession() {
  const api = useMerchantApi()
  const qc = useQueryClient()

  return useMutationWithToast({
    mutationFn: (id: string) => api.paymentSessions.cancel(id),
    messages: {
      loading: 'Cancelling session…',
      success: 'Session cancelled',
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: paymentSessionKeys.detail(id) })
      await qc.cancelQueries({ queryKey: paymentSessionKeys.lists() })

      const previousDetail = qc.getQueryData<PaymentSession>(paymentSessionKeys.detail(id))
      const previousLists = qc.getQueriesData<Page<PaymentSession>>({
        queryKey: paymentSessionKeys.lists(),
      })

      // Optimistic detail patch.
      if (previousDetail) {
        qc.setQueryData(paymentSessionKeys.detail(id), {
          ...previousDetail,
          status: 'cancelled' as const,
        })
      }

      // Optimistic list patches — only touch lists that already render the row.
      for (const [key, page] of previousLists) {
        if (!page) continue
        const idx = page.data.findIndex((row) => row.id === id)
        if (idx === -1) continue
        const target = page.data[idx]
        if (!target) continue
        const nextData = [...page.data]
        nextData[idx] = { ...target, status: 'cancelled' as const }
        qc.setQueryData(key, { ...page, data: nextData })
      }

      return { previousDetail, previousLists }
    },
    onError: (_err, _id, ctx) => {
      if (!ctx) return
      if (ctx.previousDetail) {
        qc.setQueryData(paymentSessionKeys.detail(ctx.previousDetail.id), ctx.previousDetail)
      }
      for (const [key, snapshot] of ctx.previousLists) {
        qc.setQueryData(key, snapshot)
      }
    },
    onSettled: (_data, _err, id) => {
      // Reconcile with server truth — handles cases where the server's
      // canceled-at timestamp etc. differ from our optimistic guess.
      qc.invalidateQueries({ queryKey: paymentSessionKeys.detail(id) })
      qc.invalidateQueries({ queryKey: paymentSessionKeys.lists() })
    },
  })
}

/**
 * Helper to prefetch a session detail — useful from list-row hover so
 * clicking through to /payments/:id renders instantly. The dashboard
 * UI hooks this onto `onMouseEnter`/`onFocus`.
 */
export function usePrefetchPaymentSession() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return (id: string) =>
    qc.prefetchQuery({
      queryKey: paymentSessionKeys.detail(id),
      queryFn: ({ signal }) => api.paymentSessions.retrieve(id, { signal }),
    })
}
