import type {
  CreateWebhookEndpointInput,
  CreateWebhookEndpointOutput,
  WebhookDelivery,
  WebhookEndpoint,
} from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export interface ListWebhookDeliveriesParams extends PaginationParams {
  endpointId?: string
  eventName?: string
}

export class WebhookEndpointsResource {
  constructor(private readonly client: MerchantApiClient) {}

  list(params: PaginationParams = {}, options?: CallOptions): Promise<Page<WebhookEndpoint>> {
    return this.client.get<Page<WebhookEndpoint>>('/v1/webhook-endpoints', {
      ...options,
      query: { cursor: params.cursor, limit: params.limit },
    })
  }

  retrieve(id: string, options?: CallOptions): Promise<WebhookEndpoint> {
    return this.client.get<WebhookEndpoint>(
      `/v1/webhook-endpoints/${encodeURIComponent(id)}`,
      options,
    )
  }

  /**
   * Returns the signing secret in plaintext exactly once. Subsequent
   * GETs return the endpoint without the secret — the merchant must
   * rotate to recover access.
   */
  create(
    input: CreateWebhookEndpointInput,
    options?: CallOptions,
  ): Promise<CreateWebhookEndpointOutput> {
    return this.client.post<CreateWebhookEndpointOutput>('/v1/webhook-endpoints', input, options)
  }

  disable(id: string, options?: CallOptions): Promise<WebhookEndpoint> {
    return this.client.post<WebhookEndpoint>(
      `/v1/webhook-endpoints/${encodeURIComponent(id)}/disable`,
      {},
      options,
    )
  }

  enable(id: string, options?: CallOptions): Promise<WebhookEndpoint> {
    return this.client.post<WebhookEndpoint>(
      `/v1/webhook-endpoints/${encodeURIComponent(id)}/enable`,
      {},
      options,
    )
  }

  /**
   * Rotates the signing secret. The returned plaintext is shown once
   * (same contract as `create`) — the previous secret is invalidated
   * server-side at the moment this call returns.
   */
  rotateSecret(id: string, options?: CallOptions): Promise<CreateWebhookEndpointOutput> {
    return this.client.post<CreateWebhookEndpointOutput>(
      `/v1/webhook-endpoints/${encodeURIComponent(id)}/rotate-secret`,
      {},
      options,
    )
  }

  listDeliveries(
    params: ListWebhookDeliveriesParams = {},
    options?: CallOptions,
  ): Promise<Page<WebhookDelivery>> {
    return this.client.get<Page<WebhookDelivery>>('/v1/webhook-deliveries', {
      ...options,
      query: {
        cursor: params.cursor,
        limit: params.limit,
        endpointId: params.endpointId,
        eventName: params.eventName,
      },
    })
  }
}
