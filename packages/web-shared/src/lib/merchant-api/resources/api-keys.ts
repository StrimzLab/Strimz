import type { ApiKey, CreateApiKeyInput, CreateApiKeyOutput } from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export interface ListApiKeysParams extends PaginationParams {
  revoked?: boolean
}

export class ApiKeysResource {
  constructor(private readonly client: MerchantApiClient) {}

  list(params: ListApiKeysParams = {}, options?: CallOptions): Promise<Page<ApiKey>> {
    return this.client.get<Page<ApiKey>>('/v1/api-keys', {
      ...options,
      query: {
        cursor: params.cursor,
        limit: params.limit,
        revoked: params.revoked === true ? 'true' : params.revoked === false ? 'false' : undefined,
      },
    })
  }

  retrieve(id: string, options?: CallOptions): Promise<ApiKey> {
    return this.client.get<ApiKey>(`/v1/api-keys/${encodeURIComponent(id)}`, options)
  }

  create(input: CreateApiKeyInput, options?: CallOptions): Promise<CreateApiKeyOutput> {
    return this.client.post<CreateApiKeyOutput>('/v1/api-keys', input, options)
  }

  revoke(id: string, options?: CallOptions): Promise<ApiKey> {
    return this.client.post<ApiKey>(`/v1/api-keys/${encodeURIComponent(id)}/revoke`, {}, options)
  }

  rotate(id: string, options?: CallOptions): Promise<CreateApiKeyOutput> {
    return this.client.post<CreateApiKeyOutput>(
      `/v1/api-keys/${encodeURIComponent(id)}/rotate`,
      {},
      options,
    )
  }
}
