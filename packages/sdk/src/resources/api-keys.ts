import {
  apiKeySchema,
  createApiKeyInputSchema,
  createApiKeyOutputSchema,
  type ApiKey,
  type CreateApiKeyInput,
  type CreateApiKeyOutput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class ApiKeysResource extends BaseResource {
  list(params?: PaginationParams): Promise<Page<ApiKey>> {
    return this.listPage('/v1/api-keys', apiKeySchema, params)
  }

  retrieve(id: string): Promise<ApiKey> {
    return this.get(`/v1/api-keys/${encodeURIComponent(id)}`, apiKeySchema)
  }

  create(input: CreateApiKeyInput, options?: RequestOptions): Promise<CreateApiKeyOutput> {
    createApiKeyInputSchema.parse(input)
    return this.post('/v1/api-keys', input, createApiKeyOutputSchema, options)
  }

  revoke(id: string, options?: RequestOptions): Promise<ApiKey> {
    return this.post(`/v1/api-keys/${encodeURIComponent(id)}/revoke`, {}, apiKeySchema, options)
  }
}
