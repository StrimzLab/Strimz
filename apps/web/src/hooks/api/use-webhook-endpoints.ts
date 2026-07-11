'use client'

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type {
  CreateWebhookEndpointInput,
  CreateWebhookEndpointOutput,
  WebhookDelivery,
  WebhookDeliveryDetail,
  WebhookEndpoint,
} from '@strimz/shared-types'

import type { ListWebhookDeliveriesParams } from '@/lib/merchant-api/resources/webhook-endpoints'
import type { Page, PaginationParams } from '@/lib/merchant-api'

import { useMerchantApi } from './merchant-api-context'
import { useMutationWithToast } from './use-mutation-with-toast'
import { webhookEndpointKeys } from './query-keys'

type ListOptions<TData = Page<WebhookEndpoint>> = Omit<
  UseQueryOptions<Page<WebhookEndpoint>, Error, TData, ReturnType<typeof webhookEndpointKeys.list>>,
  'queryKey' | 'queryFn'
>

type DeliveriesOptions<TData = Page<WebhookDelivery>> = Omit<
  UseQueryOptions<
    Page<WebhookDelivery>,
    Error,
    TData,
    ReturnType<typeof webhookEndpointKeys.deliveries>
  >,
  'queryKey' | 'queryFn'
>

export function useWebhookEndpoints<TData = Page<WebhookEndpoint>>(
  params: PaginationParams = {},
  options?: ListOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: webhookEndpointKeys.list(params),
    queryFn: ({ signal }) => api.webhookEndpoints.list(params, { signal }),
    placeholderData: keepPreviousData,
    ...options,
  })
}

type EndpointOptions<TData = WebhookEndpoint> = Omit<
  UseQueryOptions<WebhookEndpoint, Error, TData, ReturnType<typeof webhookEndpointKeys.detail>>,
  'queryKey' | 'queryFn'
>

export function useWebhookEndpoint<TData = WebhookEndpoint>(
  id: string | null | undefined,
  options?: EndpointOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: webhookEndpointKeys.detail(id ?? '__unset'),
    queryFn: ({ signal }) => api.webhookEndpoints.retrieve(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

export function useWebhookDeliveries<TData = Page<WebhookDelivery>>(
  params: ListWebhookDeliveriesParams = {},
  options?: DeliveriesOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: webhookEndpointKeys.deliveries(params),
    queryFn: ({ signal }) => api.webhookEndpoints.listDeliveries(params, { signal }),
    placeholderData: keepPreviousData,
    // Webhook delivery is fast-moving; let the UI auto-refresh while
    // a delivery is in-flight. 10s is short enough to feel live, long
    // enough to be free over a hundred merchants.
    refetchInterval: 10_000,
    ...options,
  })
}

export function useCreateWebhookEndpoint() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast<CreateWebhookEndpointOutput, CreateWebhookEndpointInput>({
    mutationFn: (input) => api.webhookEndpoints.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: webhookEndpointKeys.lists() })
    },
    messages: {
      loading: 'Creating webhook endpoint…',
      success: 'Webhook created. Copy the signing secret now',
    },
  })
}

export function useDisableWebhookEndpoint() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.webhookEndpoints.disable(id),
    onSuccess: (updated) => {
      qc.setQueryData(webhookEndpointKeys.detail(updated.id), updated)
      qc.invalidateQueries({ queryKey: webhookEndpointKeys.lists() })
    },
    messages: {
      loading: 'Disabling endpoint…',
      success: 'Endpoint disabled',
    },
  })
}

export function useEnableWebhookEndpoint() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.webhookEndpoints.enable(id),
    onSuccess: (updated) => {
      qc.setQueryData(webhookEndpointKeys.detail(updated.id), updated)
      qc.invalidateQueries({ queryKey: webhookEndpointKeys.lists() })
    },
    messages: {
      loading: 'Re-enabling endpoint…',
      success: 'Endpoint re-enabled',
    },
  })
}

export function useRotateWebhookSecret() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.webhookEndpoints.rotateSecret(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: webhookEndpointKeys.lists() })
    },
    messages: {
      loading: 'Rotating signing secret…',
      success: 'New signing secret issued. Copy it now',
    },
  })
}

type DeliveryOptions<TData = WebhookDeliveryDetail> = Omit<
  UseQueryOptions<
    WebhookDeliveryDetail,
    Error,
    TData,
    ReturnType<typeof webhookEndpointKeys.delivery>
  >,
  'queryKey' | 'queryFn'
>

export function useWebhookDelivery<TData = WebhookDeliveryDetail>(
  id: string | null | undefined,
  options?: DeliveryOptions<TData>,
) {
  const api = useMerchantApi()
  return useQuery({
    queryKey: webhookEndpointKeys.delivery(id ?? '__unset'),
    queryFn: ({ signal }) => api.webhookEndpoints.retrieveDelivery(id as string, { signal }),
    enabled: typeof id === 'string' && id.length > 0,
    ...options,
  })
}

export function useReplayWebhookDelivery() {
  const api = useMerchantApi()
  const qc = useQueryClient()
  return useMutationWithToast({
    mutationFn: (id: string) => api.webhookEndpoints.replayDelivery(id),
    onSuccess: (updated) => {
      qc.setQueryData(webhookEndpointKeys.delivery(updated.id), updated)
      qc.invalidateQueries({ queryKey: webhookEndpointKeys.allDeliveries() })
    },
    messages: {
      loading: 'Re-enqueuing delivery…',
      success: 'Delivery re-enqueued',
    },
  })
}
