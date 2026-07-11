import { Injectable, Logger } from '@nestjs/common'

import { AuthService } from './auth.service.js'

// Events we react to — anything that changes fields we mirror
// (email, wallet, verification state).
const SYNC_EVENTS = new Set([
  'user.linked_account',
  'user.unlinked_account',
  'user.updated_account',
  'user.transferred_account',
  'user.authenticated',
])

interface PrivyEvent {
  type: string
  data?: {
    user?: {
      id?: string
    }
  }
}

@Injectable()
export class PrivyWebhookService {
  private readonly log = new Logger(PrivyWebhookService.name)

  constructor(private readonly auth: AuthService) {}

  async handleEvent(event: PrivyEvent): Promise<void> {
    if (!SYNC_EVENTS.has(event.type)) return
    const privyUserId = event.data?.user?.id
    if (!privyUserId) {
      this.log.warn(`privy webhook: ${event.type} without user id`)
      return
    }
    try {
      await this.auth.syncByPrivyUserId(privyUserId)
      this.log.log(`privy webhook synced: ${event.type} user=${privyUserId}`)
    } catch (err) {
      this.log.error(
        `privy webhook sync failed: ${event.type} user=${privyUserId}: ${(err as Error).message}`,
      )
    }
  }
}
