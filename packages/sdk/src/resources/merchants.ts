import { merchantSchema, updateMerchantInputSchema, changeTierInputSchema, type Merchant, type UpdateMerchantInput, type ChangeTierInput } from '@strimz/shared-types'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class MerchantsResource extends BaseResource {
  /** The merchant the API key belongs to. */
  me(): Promise<Merchant> {
    return this.get('/v1/merchants/me', merchantSchema)
  }

  update(input: UpdateMerchantInput, options?: RequestOptions): Promise<Merchant> {
    updateMerchantInputSchema.parse(input)
    return this.patch('/v1/merchants/me', input, merchantSchema, options)
  }

  changeTier(input: ChangeTierInput, options?: RequestOptions): Promise<Merchant> {
    changeTierInputSchema.parse(input)
    return this.post('/v1/merchants/me/tier', input, merchantSchema, options)
  }
}
