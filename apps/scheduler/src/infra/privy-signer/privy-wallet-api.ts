import { Global, Logger, Module, type FactoryProvider } from '@nestjs/common'
import {
  connectPrivyWalletApi,
  meterSignatures,
  PRIVY_MONTHLY_SIGNATURE_WARNING,
  type PrivyWalletApi,
} from '@strimz/signer'

import { TypedConfigService } from '../../config/index.js'
import { EmailService } from '../email/email.service.js'
import { RedisService } from '../redis/redis.service.js'
import { alertOnPolicyRefusal } from './policy-alert.js'

/** Privy's wallet API; null unless a signer uses Privy. Overridden in tests. */
export const PRIVY_WALLET_API = Symbol('PRIVY_WALLET_API')

const privyWalletApiProvider: FactoryProvider<PrivyWalletApi | null> = {
  provide: PRIVY_WALLET_API,
  inject: [TypedConfigService, EmailService, RedisService],
  useFactory: (
    { env }: TypedConfigService,
    email: EmailService,
    redis: RedisService,
  ): PrivyWalletApi | null => {
    if (env.SCHEDULER_SIGNER_PROVIDER !== 'privy' && env.REFUND_SIGNER_PROVIDER !== 'privy') {
      return null
    }
    if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET || !env.PRIVY_SIGNER_AUTHORIZATION_KEY) {
      throw new Error(
        'PRIVY_APP_ID, PRIVY_APP_SECRET and PRIVY_SIGNER_AUTHORIZATION_KEY are required',
      )
    }
    const api = connectPrivyWalletApi({
      appId: env.PRIVY_APP_ID,
      appSecret: env.PRIVY_APP_SECRET,
      authorizationKey: env.PRIVY_SIGNER_AUTHORIZATION_KEY,
    })
    const log = new Logger('PrivySigner')
    return meterSignatures(alertOnPolicyRefusal(api, email, env.STRIMZ_ADMIN_ALERT_EMAIL), {
      incr: async (key) => {
        const n = await redis.client.incr(key)
        if (n === 1) await redis.client.expire(key, 40 * 86_400)
        return n
      },
      warnAt: PRIVY_MONTHLY_SIGNATURE_WARNING,
      onWarn: async (count, month) => {
        const subject = `Privy signatures at ${count} for ${month}: the free plan ends at 50,000`
        log.warn(subject)
        await email.send({ to: env.STRIMZ_ADMIN_ALERT_EMAIL, subject, html: `<p>${subject}.</p>` })
      },
      onError: (err) => log.error(`Privy signature count failed: ${(err as Error).message}`),
    })
  },
}

@Global()
@Module({ providers: [privyWalletApiProvider], exports: [PRIVY_WALLET_API] })
export class PrivyWalletApiModule {}
