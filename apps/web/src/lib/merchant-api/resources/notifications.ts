import type { MarkNotificationsReadResponse, NotificationListResponse } from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions } from '../types'

/**
 * Dashboard notifications. The API derives the list server-side from
 * the merchant's recent confirmed payment sessions, new subscribers,
 * and processed refunds. Read state resolves against the merchant's
 * `notificationsLastReadAt` column. The client is a thin passthrough.
 */
export class NotificationsResource {
  constructor(private readonly client: MerchantApiClient) {}

  /** GET /v1/notifications */
  list(limit = 20, options?: CallOptions): Promise<NotificationListResponse> {
    return this.client.get<NotificationListResponse>('/v1/notifications', {
      ...options,
      query: { limit },
    })
  }

  /** POST /v1/notifications/mark-all-read */
  markAllRead(options?: CallOptions): Promise<MarkNotificationsReadResponse> {
    return this.client.post<MarkNotificationsReadResponse>(
      '/v1/notifications/mark-all-read',
      {},
      options,
    )
  }
}
