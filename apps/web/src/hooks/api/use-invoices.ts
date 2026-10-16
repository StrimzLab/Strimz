'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type { CreateInvoiceInput, Invoice } from '@strimz/shared-types'

import type { ListInvoicesParams } from '@/lib/merchant-api/resources/invoices'
import type { Page } from '@/lib/merchant-api'
import type { LoadedRows } from '@/lib/cursor-pages'

import { useMerchantApi } from './merchant-api-context'
import { useCursorList } from './use-cursor-list'
import { useMutationWithToast } from './use-mutation-with-toast'
import { analyticsKeys, invoiceKeys } from './query-keys'

type ListOptions<TData = Page<Invoice>> = Omit<
  UseQueryOptions<Page<Invoice>, Error, TData, ReturnType<typeof invoiceKeys.list>>,
  'queryKey' | 'queryFn'
>

type DetailOptions<TData = Invoice> = Omit<
  UseQueryOptions<Invoice, Error, TData, ReturnType<typeof invoiceKeys.detail>>,
  'queryKey' | 'queryFn'
>

export function useInvoices<TData = Page<Invoice>>(
  params: ListInvoicesParams = {},
  options?: ListOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: ({ signal }) => api.invoices.list(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useInvoice<TData = Invoice>(
  id: string | null | undefined,
  options?: DetailOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? '__unset'),
    queryFn: ({ signal }) => api.invoices.retrieve(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

export function useCreateInvoice() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (input: CreateInvoiceInput) => api.invoices.create(input),
    onSuccess: (created) => {
      qc.setQueryData(invoiceKeys.detail(created.id), created)
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() })
      qc.invalidateQueries({ queryKey: analyticsKeys.all })
    },
    messages: {
      loading: 'Creating invoice…',
      success: (inv) => `Invoice ${inv.number} created`,
    },
  })
}

export function useSendInvoice() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.invoices.send(id),
    onSuccess: (updated) => {
      qc.setQueryData(invoiceKeys.detail(updated.id), updated)
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() })
      qc.invalidateQueries({ queryKey: analyticsKeys.all })
    },
    messages: {
      loading: 'Sending invoice…',
      success: (inv) => `Invoice ${inv.number} sent`,
    },
  })
}

export function useVoidInvoice() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.invoices.void(id),
    onSuccess: (updated) => {
      qc.setQueryData(invoiceKeys.detail(updated.id), updated)
      qc.invalidateQueries({ queryKey: invoiceKeys.lists() })
      qc.invalidateQueries({ queryKey: analyticsKeys.all })
    },
    messages: {
      loading: 'Voiding invoice…',
      success: (inv) => `Invoice ${inv.number} voided`,
    },
  })
}

export function useInvoicePages<TView>(
  params: Omit<ListInvoicesParams, 'cursor'>,
  options: { select: (loaded: LoadedRows<Invoice>) => TView },
) {
  const api = useMerchantApi()
  return useCursorList(
    invoiceKeys.pages(params),
    (cursor, signal) => api.invoices.list({ ...params, cursor }, { signal }),
    options,
  )
}
