import { Injectable, Logger } from '@nestjs/common'

import { PrismaService } from '../../infra/prisma/prisma.service.js'
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

const PASSKEY_ACTIONS: Readonly<Record<string, string>> = {
  'user.linked_account': 'passkey.added',
  'user.unlinked_account': 'passkey.removed',
}

interface PrivyEvent {
  type: string
  user?: { id: string }
  account?: { type: string }
}

@Injectable()
export class PrivyWebhookService {
  private readonly log = new Logger(PrivyWebhookService.name)

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async handleEvent(event: PrivyEvent): Promise<void> {
    if (!SYNC_EVENTS.has(event.type)) return
    const privyUserId = event.user?.id
    if (!privyUserId) {
      this.log.warn(`privy webhook: ${event.type} without user id`)
      return
    }
    try {
      // Only /auth/sync, with a checked Turnstile token, creates accounts.
      const synced = await this.auth.refreshExisting(privyUserId)
      if (!synced) {
        this.log.log(`privy webhook: ${event.type} for a user with no Strimz account; skipped`)
        return
      }
      this.log.log(`privy webhook synced: ${event.type} user=${privyUserId}`)
      const action = event.account?.type === 'passkey' ? PASSKEY_ACTIONS[event.type] : undefined
      if (action) {
        await this.prisma.db.auditLog.create({
          data: {
            merchantId: synced.merchant.id,
            actorId: synced.merchant.id,
            category: 'auth',
            action,
            targetType: 'Merchant',
            targetId: synced.merchant.id,
          },
        })
      }
    } catch (err) {
      this.log.error(
        `privy webhook sync failed: ${event.type} user=${privyUserId}: ${(err as Error).message}`,
      )
    }
  }
}
