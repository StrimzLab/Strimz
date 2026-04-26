import {
  webhookEndpointSchema,
  createWebhookEndpointInputSchema,
  createWebhookEndpointOutputSchema,
  type WebhookEndpoint,
  type CreateWebhookEndpointInput,
  type CreateWebhookEndpointOutput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class WebhookEndpointsResource extends BaseResource {
  create(
    input: CreateWebhookEndpointInput,
    options?: RequestOptions,
  ): Promise<CreateWebhookEndpointOutput> {
    createWebhookEndpointInputSchema.parse(input)
    return this.post('/v1/webhook-endpoints', input, createWebhookEndpointOutputSchema, options)
  }

  retrieve(id: string): Promise<WebhookEndpoint> {
    return this.get(`/v1/webhook-endpoints/${encodeURIComponent(id)}`, webhookEndpointSchema)
  }

  list(params?: PaginationParams): Promise<Page<WebhookEndpoint>> {
    return this.listPage('/v1/webhook-endpoints', webhookEndpointSchema, params)
  }

  disable(id: string, options?: RequestOptions): Promise<WebhookEndpoint> {
    return this.post(
      `/v1/webhook-endpoints/${encodeURIComponent(id)}/disable`,
      {},
      webhookEndpointSchema,
      options,
    )
  }

  enable(id: string, options?: RequestOptions): Promise<WebhookEndpoint> {
    return this.post(
      `/v1/webhook-endpoints/${encodeURIComponent(id)}/enable`,
      {},
      webhookEndpointSchema,
      options,
    )
  }

  /** Rotates the signing secret. Returns the new full secret exactly once. */
  rotateSecret(id: string, options?: RequestOptions): Promise<CreateWebhookEndpointOutput> {
    return this.post(
      `/v1/webhook-endpoints/${encodeURIComponent(id)}/rotate-secret`,
      {},
      createWebhookEndpointOutputSchema,
      options,
    )
  }
}
