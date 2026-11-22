import { Logger, type FactoryProvider } from '@nestjs/common'
import {
  AwsKmsSigner,
  PrivyServerSigner,
  SoftwareSigner,
  type PrivyWalletApi,
  type TransactionSigner,
} from '@strimz/signer'

import { TypedConfigService, type Env } from '../../config/index.js'
import { PRIVY_WALLET_API } from '../privy-signer/privy-wallet-api.js'

export const SCHEDULER_SIGNER = Symbol('SCHEDULER_SIGNER')

function requireSetting(
  env: Env,
  key:
    | 'SCHEDULER_PRIVATE_KEY'
    | 'SCHEDULER_KMS_KEY_ID'
    | 'SCHEDULER_SIGNER_ADDRESS'
    | 'AWS_REGION'
    | 'PRIVY_SCHEDULER_WALLET_ID',
): string {
  const value = env[key]
  if (!value) {
    throw new Error(
      `${key} is required for SCHEDULER_SIGNER_PROVIDER=${env.SCHEDULER_SIGNER_PROVIDER}`,
    )
  }
  return value
}

export const schedulerSignerProvider = {
  provide: SCHEDULER_SIGNER,
  inject: [TypedConfigService, PRIVY_WALLET_API],
  useFactory: async (
    cfg: TypedConfigService,
    privyApi: PrivyWalletApi | null,
  ): Promise<TransactionSigner> => {
    const log = new Logger('SchedulerSigner')
    const provider = cfg.env.SCHEDULER_SIGNER_PROVIDER

    if (provider === 'privy') {
      if (!privyApi) throw new Error('the Privy wallet API is not configured')
      const walletId = requireSetting(cfg.env, 'PRIVY_SCHEDULER_WALLET_ID')
      const signer = await PrivyServerSigner.connect({
        api: privyApi,
        walletId,
        expectedAddress: requireSetting(cfg.env, 'SCHEDULER_SIGNER_ADDRESS') as `0x${string}`,
      })
      log.log(`signing with Privy wallet ${walletId}`)
      return signer
    }

    if (provider === 'aws-kms') {
      const keyId = requireSetting(cfg.env, 'SCHEDULER_KMS_KEY_ID')
      const signer = await AwsKmsSigner.connect({
        keyId,
        expectedAddress: requireSetting(cfg.env, 'SCHEDULER_SIGNER_ADDRESS') as `0x${string}`,
        region: requireSetting(cfg.env, 'AWS_REGION'),
      })
      log.log(`signing with AWS KMS key ${keyId}`)
      return signer
    }

    if (provider === 'software') {
      if (cfg.env.NODE_ENV === 'production') {
        log.warn('signing with a plaintext key on testnet; not allowed on mainnet')
      }
      return new SoftwareSigner(requireSetting(cfg.env, 'SCHEDULER_PRIVATE_KEY') as `0x${string}`)
    }

    throw new Error(`unsupported SCHEDULER_SIGNER_PROVIDER: ${String(provider)}`)
  },
} satisfies FactoryProvider<TransactionSigner>
