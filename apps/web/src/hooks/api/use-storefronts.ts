'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type {
  CreateStorefrontInput,
  CreateStorefrontProductInput,
  Storefront,
  StorefrontProduct,
} from '@strimz/shared-types'

import type { Page, PaginationParams } from '@/lib/merchant-api'

import { useMerchantApi } from './merchant-api-context'
import { useMutationWithToast } from './use-mutation-with-toast'
import { storefrontKeys } from './query-keys'

type DetailOptions<TData = Storefront | null> = Omit<
  UseQueryOptions<Storefront | null, Error, TData, ReturnType<typeof storefrontKeys.detail>>,
  'queryKey' | 'queryFn'
>

type ProductsOptions<TData = Page<StorefrontProduct>> = Omit<
  UseQueryOptions<
    Page<StorefrontProduct>,
    Error,
    TData,
    ReturnType<typeof storefrontKeys.productList>
  >,
  'queryKey' | 'queryFn'
>

export function useStorefront<TData = Storefront | null>(options?: DetailOptions<TData>) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: storefrontKeys.detail(),
    queryFn: ({ signal }) => api.storefronts.retrieve({ signal }),
    staleTime: 2 * 60_000,
    ...options,
  })
}

export function useUpsertStorefront() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: CreateStorefrontInput) => api.storefronts.upsert(input),
    onSuccess: (sf) => {
      qc.setQueryData(storefrontKeys.detail(), sf)
    },
    messages: {
      loading: 'Saving storefront…',
      success: 'Storefront saved',
    },
  })
}

export function usePublishStorefront() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast<Storefront, void>({
    mutationFn: () => api.storefronts.publish(),
    onSuccess: (sf) => {
      qc.setQueryData(storefrontKeys.detail(), sf)
    },
    messages: {
      loading: 'Publishing storefront…',
      success: 'Storefront published',
    },
  })
}

export function useArchiveStorefront() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast<Storefront, void>({
    mutationFn: () => api.storefronts.archive(),
    onSuccess: (sf) => {
      qc.setQueryData(storefrontKeys.detail(), sf)
    },
    messages: {
      loading: 'Archiving storefront…',
      success: 'Storefront archived',
    },
  })
}

export function useStorefrontProducts<TData = Page<StorefrontProduct>>(
  params: PaginationParams = {},
  options?: ProductsOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: storefrontKeys.productList(params),
    queryFn: ({ signal }) => api.storefronts.listProducts(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useAddStorefrontProduct() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: CreateStorefrontProductInput) => api.storefronts.addProduct(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storefrontKeys.products() })
    },
    messages: {
      loading: 'Adding product…',
      success: (product) => `Added ${product.name}`,
    },
  })
}

export function useArchiveStorefrontProduct() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.storefronts.archiveProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storefrontKeys.products() })
    },
    messages: {
      loading: 'Archiving product…',
      success: 'Product archived',
    },
  })
}
