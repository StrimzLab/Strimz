'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type { CancelSubscriptionInput, Subscription } from '@strimz/shared-types'

import type { ListSubscriptionsParams } from '@/lib/merchant-api/resources/subscriptions'
import type { Page } from '@/lib/merchant-api'

import { useMerchantApi } from './merchant-api-context'
import { useMutationWithToast } from './use-mutation-with-toast'
import { subscriptionKeys } from './query-keys'

type ListOptions<TData = Page<Subscription>> = Omit<
  UseQueryOptions<Page<Subscription>, Error, TData, ReturnType<typeof subscriptionKeys.list>>,
  'queryKey' | 'queryFn'
>

type DetailOptions<TData = Subscription> = Omit<
  UseQueryOptions<Subscription, Error, TData, ReturnType<typeof subscriptionKeys.detail>>,
  'queryKey' | 'queryFn'
>

export function useSubscriptions<TData = Page<Subscription>>(
  params: ListSubscriptionsParams = {},
  options?: ListOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: subscriptionKeys.list(params),
    queryFn: ({ signal }) => api.subscriptions.list(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useSubscription<TData = Subscription>(
  id: string | null | undefined,
  options?: DetailOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: subscriptionKeys.detail(id ?? '__unset'),
    queryFn: ({ signal }) => api.subscriptions.retrieve(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

/**
 * Cancel a subscription. Two cancellation modes are supported server-side:
 *   - `at_period_end`: status stays `active`, `cancelledAt` is stamped.
 *   - `immediate`: status flips to `cancelled` immediately.
 *
 * We don't optimistic-flip the status because the at-period-end variant
 * keeps the row "active". Easier to invalidate-and-refetch than to
 * fork the optimistic patch on the input shape.
 */
export function useCancelSubscription() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: CancelSubscriptionInput) => api.subscriptions.cancel(input),
    onSuccess: (updated) => {
      qc.setQueryData(subscriptionKeys.detail(updated.id), updated)
      qc.invalidateQueries({ queryKey: subscriptionKeys.lists() })
    },
    messages: {
      loading: 'Cancelling subscription…',
      success: (s) =>
        s.status === 'cancelled'
          ? 'Subscription cancelled immediately'
          : 'Subscription will end at period end',
    },
  })
}
