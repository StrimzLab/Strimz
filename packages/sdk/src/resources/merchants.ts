import { merchantSchema, type Merchant } from '@strimz/shared-types'
import { BaseResource } from './base-resource.js'

export class MerchantsResource extends BaseResource {
  /** The merchant the API key belongs to. */
  me(): Promise<Merchant> {
    return this.get('/v1/merchants/me', merchantSchema)
  }
}
