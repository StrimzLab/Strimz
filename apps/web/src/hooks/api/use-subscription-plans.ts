'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type {
  CreateSubscriptionPlanInput,
  SubscriptionPlan,
  UpdateSubscriptionPlanInput,
} from '@strimz/shared-types'

import type { ListSubscriptionPlansParams } from '@/lib/merchant-api/resources/subscription-plans'
import type { Page } from '@/lib/merchant-api'
import { patchListCacheRow, type ListCache, type LoadedRows } from '@/lib/cursor-pages'

import { useMerchantApi } from './merchant-api-context'
import { useCursorList } from './use-cursor-list'
import { useMutationWithToast } from './use-mutation-with-toast'
import { subscriptionPlanKeys } from './query-keys'

type ListOptions<TData = Page<SubscriptionPlan>> = Omit<
  UseQueryOptions<
    Page<SubscriptionPlan>,
    Error,
    TData,
    ReturnType<typeof subscriptionPlanKeys.list>
  >,
  'queryKey' | 'queryFn'
>

type DetailOptions<TData = SubscriptionPlan> = Omit<
  UseQueryOptions<SubscriptionPlan, Error, TData, ReturnType<typeof subscriptionPlanKeys.detail>>,
  'queryKey' | 'queryFn'
>

export function useSubscriptionPlans<TData = Page<SubscriptionPlan>>(
  params: ListSubscriptionPlansParams = {},
  options?: ListOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: subscriptionPlanKeys.list(params),
    queryFn: ({ signal }) => api.subscriptionPlans.list(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useSubscriptionPlan<TData = SubscriptionPlan>(
  id: string | null | undefined,
  options?: DetailOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: subscriptionPlanKeys.detail(id ?? '__unset'),
    queryFn: ({ signal }) => api.subscriptionPlans.retrieve(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

export function useCreateSubscriptionPlan() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: CreateSubscriptionPlanInput) => api.subscriptionPlans.create(input),
    onSuccess: (created) => {
      qc.setQueryData(subscriptionPlanKeys.detail(created.id), created)
      qc.invalidateQueries({ queryKey: subscriptionPlanKeys.lists() })
    },
    messages: {
      loading: (input) => `Creating ${input.name}…`,
      success: (plan) => `Plan ${plan.name} created`,
    },
  })
}

export function useUpdateSubscriptionPlan(id: string) {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: UpdateSubscriptionPlanInput) => api.subscriptionPlans.update(id, input),
    onSuccess: (updated) => {
      qc.setQueryData(subscriptionPlanKeys.detail(updated.id), updated)
      qc.invalidateQueries({ queryKey: subscriptionPlanKeys.lists() })
    },
    messages: {
      loading: 'Saving return URLs…',
      success: 'Return URLs saved',
    },
  })
}

/**
 * Archive a plan with optimistic flip to `archived`. Same
 * cache-patching playbook as cancellation: snapshot list+detail,
 * patch in-flight, rollback on error, reconcile on settle.
 */
export function useArchiveSubscriptionPlan() {
  const api = useMerchantApi()
  const qc = useQueryClient()

  return useMutationWithToast({
    mutationFn: (id: string) => api.subscriptionPlans.archive(id),
    messages: {
      loading: 'Archiving plan…',
      success: 'Plan archived',
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: subscriptionPlanKeys.detail(id) })
      await qc.cancelQueries({ queryKey: subscriptionPlanKeys.lists() })

      const previousDetail = qc.getQueryData<SubscriptionPlan>(subscriptionPlanKeys.detail(id))
      const previousLists = qc.getQueriesData<ListCache<SubscriptionPlan>>({
        queryKey: subscriptionPlanKeys.lists(),
      })

      if (previousDetail) {
        qc.setQueryData(subscriptionPlanKeys.detail(id), {
          ...previousDetail,
          status: 'archived' as const,
        })
      }
      for (const [key, cache] of previousLists) {
        const next = patchListCacheRow(cache, id, (row) => ({
          ...row,
          status: 'archived' as const,
        }))
        if (next) qc.setQueryData(key, next)
      }
      return { previousDetail, previousLists }
    },
    onError: (_e, _id, ctx) => {
      if (!ctx) return
      if (ctx.previousDetail) {
        qc.setQueryData(subscriptionPlanKeys.detail(ctx.previousDetail.id), ctx.previousDetail)
      }
      for (const [key, snapshot] of ctx.previousLists) qc.setQueryData(key, snapshot)
    },
    onSettled: (_d, _e, id) => {
      qc.invalidateQueries({ queryKey: subscriptionPlanKeys.detail(id) })
      qc.invalidateQueries({ queryKey: subscriptionPlanKeys.lists() })
    },
  })
}

export function useSubscriptionPlanPages<TView>(
  params: Omit<ListSubscriptionPlansParams, 'cursor'>,
  options: { select: (loaded: LoadedRows<SubscriptionPlan>) => TView },
) {
  const api = useMerchantApi()
  return useCursorList(
    subscriptionPlanKeys.pages(params),
    (cursor, signal) => api.subscriptionPlans.list({ ...params, cursor }, { signal }),
    options,
  )
}
