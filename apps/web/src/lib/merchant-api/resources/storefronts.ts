import type {
  CreateStorefrontInput,
  CreateStorefrontProductInput,
  Storefront,
  StorefrontProduct,
} from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export class StorefrontsResource {
  constructor(private readonly client: MerchantApiClient) {}

  retrieve(options?: CallOptions): Promise<Storefront | null> {
    return this.client.get<Storefront | null>('/v1/storefront', options)
  }

  upsert(input: CreateStorefrontInput, options?: CallOptions): Promise<Storefront> {
    return this.client.post<Storefront>('/v1/storefront', input, options)
  }

  publish(options?: CallOptions): Promise<Storefront> {
    return this.client.post<Storefront>('/v1/storefront/publish', {}, options)
  }

  archive(options?: CallOptions): Promise<Storefront> {
    return this.client.post<Storefront>('/v1/storefront/archive', {}, options)
  }

  listProducts(
    params: PaginationParams = {},
    options?: CallOptions,
  ): Promise<Page<StorefrontProduct>> {
    return this.client.get<Page<StorefrontProduct>>('/v1/storefront/products', {
      ...options,
      query: { cursor: params.cursor, limit: params.limit },
    })
  }

  retrieveProduct(id: string, options?: CallOptions): Promise<StorefrontProduct> {
    return this.client.get<StorefrontProduct>(
      `/v1/storefront/products/${encodeURIComponent(id)}`,
      options,
    )
  }

  addProduct(
    input: CreateStorefrontProductInput,
    options?: CallOptions,
  ): Promise<StorefrontProduct> {
    return this.client.post<StorefrontProduct>('/v1/storefront/products', input, options)
  }

  archiveProduct(id: string, options?: CallOptions): Promise<StorefrontProduct> {
    return this.client.post<StorefrontProduct>(
      `/v1/storefront/products/${encodeURIComponent(id)}/archive`,
      {},
      options,
    )
  }
}
