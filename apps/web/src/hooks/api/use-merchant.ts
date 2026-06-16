'use client'

import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import type { Merchant, OnboardMerchantInput, UpdateMerchantInput } from '@strimz/shared-types'

import { useMerchantApi } from './merchant-api-context'
import { useMutationWithToast } from './use-mutation-with-toast'
import { merchantKeys } from './query-keys'

type MeOptions<TData = Merchant> = Omit<
  UseQueryOptions<Merchant, Error, TData, ReturnType<typeof merchantKeys.me>>,
  'queryKey' | 'queryFn'
>

/**
 * Current merchant profile. Used by the dashboard shell for the
 * top-bar name, plan tier badge, and routing decisions (e.g. lock
 * `/app/live` views behind `onboardingCompleted`).
 *
 * We give this a longer `staleTime` than transactional resources —
 * the merchant record changes rarely (settings save, tier change), so
 * background refetch on every focus would be wasted work.
 */
export function useMerchantMe<TData = Merchant>(options?: MeOptions<TData>) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: merchantKeys.me(),
    queryFn: ({ signal }) => api.merchant.retrieve({ signal }),
    staleTime: 5 * 60_000, // 5 minutes — overrides the global 30s default.
    ...options,
  })
}

/**
 * One-shot onboarding submission. Flips `onboardingCompleted` on the
 * merchant row and invalidates the merchant cache so the sidebar
 * "Unlock live mode" banner re-evaluates and any guards that depend on
 * onboardingCompleted (live-key issuance, etc.) refresh.
 */
export function useOnboardMerchant() {
  const api = useMerchantApi()
  const qc = useQueryClient()

  return useMutationWithToast({
    mutationFn: (input: OnboardMerchantInput) => api.merchant.onboard(input),
    messages: {
      loading: 'Saving your details…',
      success: 'Onboarding complete. Welcome!',
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: merchantKeys.me() })
    },
  })
}

export function useUpdateMerchant() {
  const api = useMerchantApi()
  const qc = useQueryClient()

  return useMutationWithToast({
    mutationFn: (input: UpdateMerchantInput) => api.merchant.update(input),
    messages: {
      loading: 'Saving changes…',
      success: 'Settings saved',
    },
    onMutate: async (input) => {
      // Optimistic update: the form save flips the UI immediately while
      // the request is in flight. The merchant is editing their own
      // profile; latency feel matters here.
      await qc.cancelQueries({ queryKey: merchantKeys.me() })
      const previous = qc.getQueryData<Merchant>(merchantKeys.me())
      if (previous) {
        qc.setQueryData(merchantKeys.me(), { ...previous, ...input })
      }
      return { previous }
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(merchantKeys.me(), ctx.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: merchantKeys.me() })
    },
  })
}
