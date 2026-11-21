import { ForbiddenException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@strimz/db'
import { PrivyService } from '../../infra/privy/privy.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { TurnstileService } from '../../infra/turnstile/turnstile.service.js'
import { TypedConfigService } from '../../config/index.js'
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
    private readonly prisma: PrismaService,
    private readonly turnstile: TurnstileService,
    private readonly cfg: TypedConfigService,
  ) {}

  /**
   * Idempotent: verifies the Privy access token, upserts the Merchant row,
   * mirrors profile fields. Safe to call on every dashboard load — the
   * client uses it as both "create on first login" and "refresh profile".
   */
  async sync(
    privyAccessToken: string,
    signup: { turnstileToken?: string; ip?: string } = {},
  ): Promise<SyncResult> {
    const claims = await this.privy.verifyAccessToken(privyAccessToken)
    return this.syncByPrivyUserId(claims.userId, () => this.assertHuman(signup))
  }

  /** Refreshes an existing merchant from Privy; never creates one. Null when there is none. */
  async refreshExisting(privyUserId: string): Promise<SyncResult | null> {
    const exists = await this.prisma.db.merchant.findUnique({
      where: { privyUserId },
      select: { id: true },
    })
    if (!exists) return null
    return this.syncByPrivyUserId(privyUserId, () => {
      throw new Error(`merchant for ${privyUserId} vanished during refresh`)
    })
  }

  // Bots can finish a Privy login without our page, so creating a Strimz account
  // needs a Turnstile token our server has checked (ADR-2026-11-21-custom-auth-screens).
  private async assertHuman(signup: { turnstileToken?: string; ip?: string }): Promise<void> {
    const host = new URL(this.cfg.env.STRIMZ_DASHBOARD_URL).hostname
    if (await this.turnstile.verify(signup.turnstileToken, signup.ip, 'signup', host)) return
    throw new HttpException(
      {
        code: 'turnstile_required',
        message: 'confirm you are not a bot to finish creating your account',
      },
      HttpStatus.PRECONDITION_REQUIRED,
    )
  }

  private async syncByPrivyUserId(
    privyUserId: string,
    beforeCreate: () => Promise<void>,
  ): Promise<SyncResult> {
    const user = await this.privy.getUser(privyUserId)

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
      where: { privyUserId: privyUserId },
    })

    // Fields refreshed on every sync — Privy is the source of truth for
    // identity + embedded-wallet address. `payoutAddress` intentionally
    // isn't in here: we only seed it from the wallet on a row that's
    // never had one, so a merchant's deliberate payout choice never
    // gets overwritten by a login.
    const refreshFields = {
      email,
      emailVerified,
      twoFactorEnabled,
      walletAddress: wallet ?? existing?.walletAddress ?? null,
      lastLoginAt: new Date(),
    }

    if (existing) {
      const updated = await this.prisma.db.merchant.update({
        where: { id: existing.id },
        data: {
          ...refreshFields,
          payoutAddress: existing.payoutAddress ?? wallet,
        },
      })
      return { merchant: serialiseMerchant(updated), isNewMerchant: false }
    }

    await beforeCreate()

    // First-time login for this privyUserId. Two concurrent /auth/sync
    // requests can both land here after both `findUnique` calls return
    // `null` — React StrictMode double-fires effects in dev, and
    // multi-tab logins do the same in prod. Whoever wins the row wins;
    // the loser sees Prisma's P2002 (unique constraint) on `privyUserId`
    // and gracefully switches to the update path.
    try {
      const created = await this.prisma.db.merchant.create({
        data: {
          privyUserId: privyUserId,
          payoutAddress: wallet,
          ...refreshFields,
        },
      })
      this.log.log(`merchant created via privy: ${created.id} (${email})`)
      return { merchant: serialiseMerchant(created), isNewMerchant: true }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const row = await this.prisma.db.merchant.findUniqueOrThrow({
          where: { privyUserId: privyUserId },
        })
        const updated = await this.prisma.db.merchant.update({
          where: { id: row.id },
          data: {
            ...refreshFields,
            payoutAddress: row.payoutAddress ?? wallet,
          },
        })
        return { merchant: serialiseMerchant(updated), isNewMerchant: false }
      }
      throw err
    }
  }
}
