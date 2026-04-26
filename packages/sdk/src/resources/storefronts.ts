import {
  storefrontSchema,
  createStorefrontInputSchema,
  storefrontProductSchema,
  createStorefrontProductInputSchema,
  type Storefront,
  type CreateStorefrontInput,
  type StorefrontProduct,
  type CreateStorefrontProductInput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class StorefrontsResource extends BaseResource {
  /** Retrieve the merchant's own storefront. */
  retrieve(): Promise<Storefront> {
    return this.get('/v1/storefront', storefrontSchema)
  }

  upsert(input: CreateStorefrontInput, options?: RequestOptions): Promise<Storefront> {
    createStorefrontInputSchema.parse(input)
    return this.post('/v1/storefront', input, storefrontSchema, options)
  }

  publish(options?: RequestOptions): Promise<Storefront> {
    return this.post('/v1/storefront/publish', {}, storefrontSchema, options)
  }

  archive(options?: RequestOptions): Promise<Storefront> {
    return this.post('/v1/storefront/archive', {}, storefrontSchema, options)
  }

  // ----- Products -----

  listProducts(params?: PaginationParams): Promise<Page<StorefrontProduct>> {
    return this.listPage('/v1/storefront/products', storefrontProductSchema, params)
  }

  createProduct(
    input: CreateStorefrontProductInput,
    options?: RequestOptions,
  ): Promise<StorefrontProduct> {
    createStorefrontProductInputSchema.parse(input)
    return this.post('/v1/storefront/products', input, storefrontProductSchema, options)
  }

  retrieveProduct(productId: string): Promise<StorefrontProduct> {
    return this.get(
      `/v1/storefront/products/${encodeURIComponent(productId)}`,
      storefrontProductSchema,
    )
  }

  archiveProduct(productId: string, options?: RequestOptions): Promise<StorefrontProduct> {
    return this.post(
      `/v1/storefront/products/${encodeURIComponent(productId)}/archive`,
      {},
      storefrontProductSchema,
      options,
    )
  }
}
