import { Injectable } from '@nestjs/common'
import { isBlockedAddress } from './blocked-addresses.js'

@Injectable()
export class WebhookTargetPolicy {
  permits(address: string, _port: number): boolean {
    return !isBlockedAddress(address)
  }
}
