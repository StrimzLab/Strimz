'use client'

import { keepPreviousData, useQuery, type UseQueryOptions } from '@tanstack/react-query'
import type { Transaction } from '@strimz/shared-types'

import type { ListTransactionsParams } from '@/lib/merchant-api/resources/transactions'
import type { Page } from '@/lib/merchant-api'

import { useMerchantApi } from './merchant-api-context'
import { transactionKeys } from './query-keys'

type ListOptions<TData = Page<Transaction>> = Omit<
  UseQueryOptions<Page<Transaction>, Error, TData, ReturnType<typeof transactionKeys.list>>,
  'queryKey' | 'queryFn'
>

type DetailOptions<TData = Transaction> = Omit<
  UseQueryOptions<Transaction, Error, TData, ReturnType<typeof transactionKeys.detail>>,
  'queryKey' | 'queryFn'
>

export function useTransactions<TData = Page<Transaction>>(
  params: ListTransactionsParams = {},
  options?: ListOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: transactionKeys.list(params),
    queryFn: ({ signal }) => api.transactions.list(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useTransaction<TData = Transaction>(
  id: string | null | undefined,
  options?: DetailOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: transactionKeys.detail(id ?? '__unset'),
    queryFn: ({ signal }) => api.transactions.retrieve(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}
