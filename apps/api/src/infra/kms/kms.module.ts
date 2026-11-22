import { Global, Logger, Module, type FactoryProvider } from '@nestjs/common'
import {
  AwsKmsSigner,
  connectPrivyWalletApi,
  meterSignatures,
  PRIVY_MONTHLY_SIGNATURE_WARNING,
  PrivyServerSigner,
  SoftwareSigner,
  type PrivyWalletApi,
  type TransactionSigner,
} from '@strimz/signer'

import { TypedConfigService, type Env } from '../../config/index.js'
import { EmailService } from '../email/email.service.js'
import { RedisService } from '../redis/redis.service.js'
import { KMS_SIGNER, PRIVY_WALLET_API } from './kms.tokens.js'

const privyWalletApiProvider: FactoryProvider<PrivyWalletApi | null> = {
  provide: PRIVY_WALLET_API,
  inject: [TypedConfigService, RedisService, EmailService],
  useFactory: (
    cfg: TypedConfigService,
    redis: RedisService,
    email: EmailService,
  ): PrivyWalletApi | null => {
    if (cfg.env.KMS_PROVIDER !== 'privy') return null
    const log = new Logger('PrivySigner')
    const api = connectPrivyWalletApi({
      appId: cfg.env.PRIVY_APP_ID,
      appSecret: cfg.env.PRIVY_APP_SECRET,
      authorizationKey: requireSetting(cfg.env, 'PRIVY_SIGNER_AUTHORIZATION_KEY'),
    })
    return meterSignatures(api, {
      incr: async (key) => {
        const n = await redis.client.incr(key)
        if (n === 1) await redis.client.expire(key, 40 * 86_400)
        return n
      },
      warnAt: PRIVY_MONTHLY_SIGNATURE_WARNING,
      onWarn: async (count, month) => {
        const subject = `Privy signatures at ${count} for ${month}: the free plan ends at 50,000`
        log.warn(subject)
        const to = cfg.env.OPS_ALERT_EMAIL
        if (to) await email.send({ to, subject, html: `<p>${subject}.</p>`, text: subject })
      },
      onError: (err) => log.error(`Privy signature count failed: ${(err as Error).message}`),
    })
  },
}

const kmsSignerProvider: FactoryProvider<TransactionSigner> = {
  provide: KMS_SIGNER,
  inject: [TypedConfigService, PRIVY_WALLET_API],
  useFactory: async (
    cfg: TypedConfigService,
    privyApi: PrivyWalletApi | null,
  ): Promise<TransactionSigner> => {
    const log = new Logger('KmsModule')
    const provider = cfg.env.KMS_PROVIDER

    // ADR-2026-11-22-privy-server-signers: on mainnet the key never sits on the server.
    if (
      cfg.env.NODE_ENV === 'production' &&
      cfg.env.ARC_ENVIRONMENT === 'mainnet' &&
      provider !== 'privy'
    ) {
      throw new Error(
        `KMS: KMS_PROVIDER=${provider} is refused in production on mainnet; set KMS_PROVIDER=privy`,
      )
    }

    if (provider === 'privy') {
      if (!privyApi) throw new Error('KMS: the Privy wallet API is not configured')
      const walletId = requireSetting(cfg.env, 'PRIVY_RELAYER_WALLET_ID')
      const signer = await PrivyServerSigner.connect({
        api: privyApi,
        walletId,
        expectedAddress: requireSetting(cfg.env, 'KMS_SIGNER_ADDRESS') as `0x${string}`,
      })
      log.log(`KMS: signing with Privy wallet ${walletId} as ${signer.address}`)
      return signer
    }

    if (provider === 'aws-kms') {
      const keyId = requireSetting(cfg.env, 'KMS_AWS_KEY_ID')
      const signer = await AwsKmsSigner.connect({
        keyId,
        expectedAddress: requireSetting(cfg.env, 'KMS_SIGNER_ADDRESS') as `0x${string}`,
        region: requireSetting(cfg.env, 'AWS_REGION'),
      })
      log.log(`KMS: signing with AWS KMS key ${keyId} as ${signer.address}`)
      return signer
    }

    if (provider === 'software') {
      if (cfg.env.NODE_ENV === 'production') {
        // Testnet only: ADR-2026-11-13-testnet-software-signer.
        if (!cfg.env.KMS_SOFTWARE_PRIVATE_KEY) {
          throw new Error('KMS: KMS_SOFTWARE_PRIVATE_KEY is required in production')
        }
        log.warn('KMS: signing with a plaintext key on testnet; not allowed on mainnet')
      }
      const signer = new SoftwareSigner(
        cfg.env.KMS_SOFTWARE_PRIVATE_KEY as `0x${string}` | undefined,
      )
      if (signer.ephemeral) {
        log.warn(
          `software KMS: generated ephemeral key for ${signer.address}. ` +
            `Fund this address from the Arc faucet, or set KMS_SOFTWARE_PRIVATE_KEY ` +
            `to pin it across restarts.`,
        )
      } else {
        log.log(`software KMS: using configured key for ${signer.address}`)
      }
      return signer
    }

    // Exhaustiveness check — Zod has already validated the enum, but a
    // future value added without a handler here must fail loudly.
    throw new Error(`unsupported KMS_PROVIDER: ${String(provider)}`)
  },
}

function requireSetting(
  env: Env,
  key:
    | 'KMS_AWS_KEY_ID'
    | 'KMS_SIGNER_ADDRESS'
    | 'AWS_REGION'
    | 'PRIVY_RELAYER_WALLET_ID'
    | 'PRIVY_SIGNER_AUTHORIZATION_KEY',
): string {
  const value = env[key]
  if (!value) throw new Error(`KMS: ${key} is required when KMS_PROVIDER=${env.KMS_PROVIDER}`)
  return value
}

@Global()
@Module({
  providers: [privyWalletApiProvider, kmsSignerProvider],
  exports: [KMS_SIGNER],
})
export class KmsModule {}
