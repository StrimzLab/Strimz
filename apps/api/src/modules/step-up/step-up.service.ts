import { createHash, randomBytes } from 'node:crypto'

import { ForbiddenException, Injectable } from '@nestjs/common'

import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { PrivyService, type PasskeyCredential } from '../../infra/privy/privy.service.js'
import { RedisService } from '../../infra/redis/redis.service.js'

export const STEP_UP_ACTIONS = [
  'api_keys.create',
  'api_keys.rotate',
  'webhook_endpoints.create',
  'webhook_endpoints.rotate_secret',
] as const
export type StepUpAction = (typeof STEP_UP_ACTIONS)[number]

const GRANT_SECONDS = 300

interface Grant {
  merchantId: string
  action: StepUpAction
}

export function stepUpRequired(): ForbiddenException {
  return new ForbiddenException({
    code: 'step_up_required',
    message: 'confirm this action with your passkey',
  })
}

/** Passkey confirmation for sensitive dashboard actions (ADR-2026-11-22-passkey-step-up). */
@Injectable()
export class StepUpService {
  constructor(
    private readonly privy: PrivyService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly cfg: TypedConfigService,
  ) {}

  async start(merchantId: string, userJwt: string): Promise<unknown> {
    const privyUserId = await this.privyUserIdWithPasskey(merchantId)
    return this.privy.initPasskeyVerification(
      privyUserId,
      userJwt,
      this.cfg.env.STRIMZ_DASHBOARD_URL,
    )
  }

  async verify(
    merchantId: string,
    userJwt: string,
    action: StepUpAction,
    credential: PasskeyCredential,
  ): Promise<{ stepUpToken: string; expiresAt: string }> {
    const privyUserId = await this.privyUserIdWithPasskey(merchantId)
    await this.privy.verifyPasskey(privyUserId, userJwt, credential)
    // Privy just confirmed a passkey MFA, so the stored flag is stale until the next sign-in.
    await this.prisma.db.merchant.update({
      where: { id: merchantId },
      data: { twoFactorEnabled: true },
    })
    const token = randomBytes(32).toString('hex')
    const grant: Grant = { merchantId, action }
    await this.redis.client.set(keyFor(token), JSON.stringify(grant), 'EX', GRANT_SECONDS)
    return {
      stepUpToken: token,
      expiresAt: new Date(Date.now() + GRANT_SECONDS * 1000).toISOString(),
    }
  }

  /** Uses up the token. Throws unless it was issued to this merchant for this action. */
  async consume(
    token: string | undefined,
    merchantId: string,
    action: StepUpAction,
  ): Promise<void> {
    if (!token || !/^[0-9a-f]{64}$/u.test(token)) throw stepUpRequired()
    const raw = (await this.redis.client.getdel(keyFor(token))) as string | null
    if (!raw) throw stepUpRequired()
    const grant = JSON.parse(raw) as Grant
    if (grant.merchantId !== merchantId || grant.action !== action) throw stepUpRequired()
  }

  private async privyUserIdWithPasskey(merchantId: string): Promise<string> {
    const merchant = await this.prisma.db.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: { privyUserId: true },
    })
    const user = merchant.privyUserId ? await this.privy.getUser(merchant.privyUserId) : null
    if (!merchant.privyUserId || !user || !this.privy.hasPasskeyMfa(user)) {
      throw new ForbiddenException({
        code: 'passkey_required',
        message: 'add a passkey to your account before making this change',
      })
    }
    return merchant.privyUserId
  }
}

// Only a hash is stored, so a Redis read can't be replayed as a token.
function keyFor(token: string): string {
  return `stepup:grant:${createHash('sha256').update(token).digest('hex')}`
}
