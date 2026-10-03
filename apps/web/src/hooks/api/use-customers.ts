'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type { Customer, UpsertCustomerInput } from '@strimz/shared-types'

import type { ListCustomersParams } from '@/lib/merchant-api/resources/customers'
import type { Page } from '@/lib/merchant-api'
import type { LoadedRows } from '@/lib/cursor-pages'

import { useMerchantApi } from './merchant-api-context'
import { useCursorList } from './use-cursor-list'
import { useMutationWithToast } from './use-mutation-with-toast'
import { customerKeys } from './query-keys'

type ListOptions<TData = Page<Customer>> = Omit<
  UseQueryOptions<Page<Customer>, Error, TData, ReturnType<typeof customerKeys.list>>,
  'queryKey' | 'queryFn'
>

type DetailOptions<TData = Customer> = Omit<
  UseQueryOptions<Customer, Error, TData, ReturnType<typeof customerKeys.detail>>,
  'queryKey' | 'queryFn'
>

export function useCustomers<TData = Page<Customer>>(
  params: ListCustomersParams = {},
  options?: ListOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => api.customers.list(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useCustomer<TData = Customer>(
  id: string | null | undefined,
  options?: DetailOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: customerKeys.detail(id ?? '__unset'),
    queryFn: ({ signal }) => api.customers.retrieve(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

export function useUpsertCustomer() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: UpsertCustomerInput) => api.customers.upsert(input),
    onSuccess: (customer) => {
      qc.setQueryData(customerKeys.detail(customer.id), customer)
      qc.invalidateQueries({ queryKey: customerKeys.lists() })
    },
    messages: {
      loading: 'Saving customer…',
      success: (c) => `${c.email ?? c.displayName ?? 'Customer'} saved`,
    },
  })
}

export function useCustomerPages<TView>(
  params: Omit<ListCustomersParams, 'cursor'>,
  options: { select: (loaded: LoadedRows<Customer>) => TView },
) {
  const api = useMerchantApi()
  return useCursorList(
    customerKeys.pages(params),
    (cursor, signal) => api.customers.list({ ...params, cursor }, { signal }),
    options,
  )
}
