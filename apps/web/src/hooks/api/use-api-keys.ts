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

type DetailOptions<TData = ApiKey> = Omit<
  UseQueryOptions<ApiKey, Error, TData, ReturnType<typeof apiKeyKeys.detail>>,
  'queryKey' | 'queryFn'
>

export function useApiKey<TData = ApiKey>(
  id: string | null | undefined,
  options?: DetailOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: apiKeyKeys.detail(id ?? '__unset'),
    queryFn: ({ signal }) => api.apiKeys.retrieve(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

export function useCreateApiKey() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast<CreateApiKeyOutput, CreateApiKeyInput>({
    mutationFn: (input) => api.apiKeys.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: apiKeyKeys.lists() })
    },
    messages: {
      loading: (input) => `Creating ${input.name}…`,
      success: (result) => `${result.apiKey.name} created. Copy the secret now.`,
    },
  })
}

export function useRotateApiKey() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast<CreateApiKeyOutput, string>({
    mutationFn: (id) => api.apiKeys.rotate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: apiKeyKeys.lists() })
    },
    messages: {
      loading: 'Rotating key…',
      success: 'New key issued. Copy the secret now.',
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
