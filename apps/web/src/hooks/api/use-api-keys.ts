'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type { ApiKey, CreateApiKeyInput, CreateApiKeyOutput } from '@strimz/shared-types'

import type { ListApiKeysParams } from '@/lib/merchant-api/resources/api-keys'
import type { Page } from '@/lib/merchant-api'

import { useMerchantApi } from './merchant-api-context'
import { useMutationWithToast } from './use-mutation-with-toast'
import { apiKeyKeys } from './query-keys'

type ListOptions<TData = Page<ApiKey>> = Omit<
  UseQueryOptions<Page<ApiKey>, Error, TData, ReturnType<typeof apiKeyKeys.list>>,
  'queryKey' | 'queryFn'
>

export function useApiKeys<TData = Page<ApiKey>>(
  params: ListApiKeysParams = {},
  options?: ListOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: apiKeyKeys.list(params),
    queryFn: ({ signal }) => api.apiKeys.list(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

/**
 * Create an API key. Returns the plaintext secret — the caller must
 * surface it to the merchant exactly once. We deliberately do NOT
 * write the plaintext secret to any cache; only the `ApiKey` envelope
 * gets seeded into the lists.
 */
export function useCreateApiKey() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast<CreateApiKeyOutput, CreateApiKeyInput>({
    mutationFn: (input) => api.apiKeys.create(input),
    onSuccess: () => {
      // Lists need a refetch; we don't seed details because creation
      // doesn't return a hashed `prefix`/`hash` shape consistent with
      // the cached list row — let the server be the source of truth.
      qc.invalidateQueries({ queryKey: apiKeyKeys.lists() })
    },
    messages: {
      loading: (input) => `Creating ${input.name}…`,
      success: (result) => `${result.apiKey.name} created — copy the secret now`,
    },
  })
}

export function useRevokeApiKey() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.apiKeys.revoke(id),
    messages: {
      loading: 'Revoking API key…',
      success: 'API key revoked',
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: apiKeyKeys.lists() })
      const previous = qc.getQueriesData<Page<ApiKey>>({ queryKey: apiKeyKeys.lists() })
      const stampedAt = new Date().toISOString()
      for (const [key, page] of previous) {
        if (!page) continue
        const idx = page.data.findIndex((row) => row.id === id)
        if (idx === -1) continue
        const target = page.data[idx]
        if (!target) continue
        const nextData = [...page.data]
        nextData[idx] = { ...target, revokedAt: stampedAt }
        qc.setQueryData(key, { ...page, data: nextData })
      }
      return { previous }
    },
    onError: (_e, _id, ctx) => {
      if (!ctx) return
      for (const [key, snap] of ctx.previous) qc.setQueryData(key, snap)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: apiKeyKeys.lists() })
    },
  })
}
