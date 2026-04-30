import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { PrivyClient, type AuthTokenClaims, type User } from '@privy-io/server-auth'
import { TypedConfigService } from '../../config/index.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Server-side Privy adapter.
 *
 * - Verifies inbound Privy access tokens (`Bearer <token>`) presented by the
 *   merchant dashboard.
 * - Fetches the full Privy user record (linked accounts: email, wallet, social,
 *   MFA status) so we can mirror it onto our `Merchant` row.
 *
 * Privy is the canonical store for credentials; the API never sees plaintext
 * passwords. MFA enforcement happens in the Privy dashboard (require for
 * "live mode" is enforced by us before issuing live API keys).
 */
@Injectable()
export class PrivyService {
  private readonly log = new Logger(PrivyService.name)
  public readonly client: PrivyClient

  constructor(cfg: TypedConfigService) {
    const opts: ConstructorParameters<typeof PrivyClient>[2] = cfg.env.PRIVY_VERIFICATION_KEY
      ? { walletApi: { authorizationPrivateKey: cfg.env.PRIVY_VERIFICATION_KEY } }
      : undefined
    this.client = new PrivyClient(cfg.env.PRIVY_APP_ID, cfg.env.PRIVY_APP_SECRET, opts)
  }

  /**
   * Verify an inbound `Authorization: Bearer <token>` value.
   * Throws `UnauthorizedException` if the token is malformed, expired, or for
   * the wrong app.
   */
  async verifyAccessToken(token: string): Promise<AuthTokenClaims> {
    try {
      return await this.client.verifyAuthToken(token)
    } catch (err: unknown) {
      this.log.warn(`privy token verification failed: ${(err as Error).message}`)
      throw new UnauthorizedException({
        code: 'authentication_error',
        message: 'invalid or expired session',
      })
    }
  }

  /** Fetch the full Privy user record by DID. */
  async getUser(privyUserId: string): Promise<User> {
    return this.client.getUser(privyUserId)
  }

  /**
   * Pull the primary email from a Privy user, if one exists.
   * Returns null when the user only has wallet / social linked accounts.
   *
   * Privy's `linkedAccounts` is a discriminated union with strict shapes per
   * type. We treat it as `any[]` here because we only ever care about
   * `type === 'email' | 'wallet'` — far simpler than threading every
   * variant of the union.
   */
  primaryEmail(user: User): string | null {
    const fromEmailLogin = user.email?.address
    if (fromEmailLogin) return fromEmailLogin.toLowerCase()
    const accounts = user.linkedAccounts as any[]
    const linkedEmail = accounts.find((a) => a.type === 'email' && typeof a.address === 'string')
    return linkedEmail?.address?.toLowerCase() ?? null
  }

  /** Pull the primary embedded-wallet address, if Privy created one. */
  primaryWallet(user: User): string | null {
    const accounts = user.linkedAccounts as any[]
    const wallet = accounts.find(
      (a) =>
        a.type === 'wallet' &&
        typeof a.address === 'string' &&
        // Only EVM wallets — Strimz settles on Arc.
        (!a.chainType || a.chainType === 'ethereum'),
    )
    return wallet?.address?.toLowerCase() ?? null
  }

  /** True if the user has at least one MFA method registered with Privy. */
  hasMfa(user: User): boolean {
    const methods = (user as any).mfaMethods
    return Array.isArray(methods) && methods.length > 0
  }
}
