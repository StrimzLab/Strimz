import { webhookDeliverySchema, type WebhookDelivery } from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class WebhookDeliveriesResource extends BaseResource {
  retrieve(id: string): Promise<WebhookDelivery> {
    return this.get(`/v1/webhook-deliveries/${encodeURIComponent(id)}`, webhookDeliverySchema)
  }

  list(
    params?: PaginationParams & {
      endpointId?: string
      status?: string
      eventName?: string
    },
  ): Promise<Page<WebhookDelivery>> {
    return this.listPage('/v1/webhook-deliveries', webhookDeliverySchema, params)
  }

  /** Manually replay a permanently-failed delivery. */
  replay(id: string, options?: RequestOptions): Promise<WebhookDelivery> {
    return this.post(
      `/v1/webhook-deliveries/${encodeURIComponent(id)}/replay`,
      {},
      webhookDeliverySchema,
      options,
    )
  }
}
