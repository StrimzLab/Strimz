import { Injectable, ForbiddenException, Logger } from '@nestjs/common'
import { PrivyService } from '../../infra/privy/privy.service.js'
import { TurnstileService } from '../../infra/turnstile/turnstile.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import type { Merchant } from '@strimz/shared-types'
import { serialiseMerchant } from '../merchants/merchants.serialiser.js'

export interface SyncResult {
  merchant: Merchant
  /** True when this call created the Merchant row (first-time login). */
  isNewMerchant: boolean
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name)

  constructor(
    private readonly privy: PrivyService,
    private readonly turnstile: TurnstileService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Pre-signup bot-protection check. The dashboard renders Cloudflare
   * Turnstile on the signup page and posts the resulting token here before
   * opening the Privy widget. Failing this aborts the flow before any
   * Privy session is created.
   */
  async verifyTurnstile(token: string, remoteIp?: string): Promise<{ ok: boolean }> {
    // Pin the expected action to the surface the signup widget renders
    // with (`action: 'signup'`). A token minted on a different surface
    // and replayed here will be rejected even if structurally valid.
    const ok = await this.turnstile.verify(token, remoteIp, 'signup')
    if (!ok) {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: 'bot-protection check failed',
      })
    }
    return { ok: true }
  }

  /**
   * Idempotent: verifies the Privy access token, upserts the Merchant row,
   * mirrors profile fields. Safe to call on every dashboard load — the
   * client uses it as both "create on first login" and "refresh profile".
   */
  async sync(privyAccessToken: string): Promise<SyncResult> {
    const claims = await this.privy.verifyAccessToken(privyAccessToken)
    const user = await this.privy.getUser(claims.userId)

    const email = this.privy.primaryEmail(user)
    if (!email) {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: 'an email-based login is required to use Strimz',
      })
    }
    const wallet = this.privy.primaryWallet(user)
    const emailVerified = Boolean(user.email?.address) // Privy verifies email-login addresses
    const twoFactorEnabled = this.privy.hasMfa(user)

    const existing = await this.prisma.db.merchant.findUnique({
      where: { privyUserId: claims.userId },
    })

    if (existing) {
      const updated = await this.prisma.db.merchant.update({
        where: { id: existing.id },
        data: {
          email,
          emailVerified,
          twoFactorEnabled,
          // walletAddress: source of truth is the Privy embedded wallet,
          // refreshed every sync. payoutAddress: only seeded from the
          // wallet on a row that's never had one — never overwrite a
          // merchant's deliberate payout choice.
          walletAddress: wallet ?? existing.walletAddress,
          payoutAddress: existing.payoutAddress ?? wallet,
          lastLoginAt: new Date(),
        },
      })
      return { merchant: serialiseMerchant(updated), isNewMerchant: false }
    }

    const created = await this.prisma.db.merchant.create({
      data: {
        privyUserId: claims.userId,
        email,
        emailVerified,
        twoFactorEnabled,
        walletAddress: wallet,
        payoutAddress: wallet,
        lastLoginAt: new Date(),
      },
    })
    this.log.log(`merchant created via privy: ${created.id} (${email})`)
    return { merchant: serialiseMerchant(created), isNewMerchant: true }
  }
}
