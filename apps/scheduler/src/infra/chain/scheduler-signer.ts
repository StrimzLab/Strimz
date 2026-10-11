import { Logger, type FactoryProvider } from '@nestjs/common'
import { AwsKmsSigner, SoftwareSigner, type KmsSigner } from '@strimz/signer'

import { TypedConfigService, type Env } from '../../config/index.js'

export const SCHEDULER_SIGNER = Symbol('SCHEDULER_SIGNER')

function requireSetting(
  env: Env,
  key: 'SCHEDULER_PRIVATE_KEY' | 'SCHEDULER_KMS_KEY_ID' | 'SCHEDULER_SIGNER_ADDRESS' | 'AWS_REGION',
): string {
  const value = env[key]
  if (!value) {
    throw new Error(
      `${key} is required for SCHEDULER_SIGNER_PROVIDER=${env.SCHEDULER_SIGNER_PROVIDER}`,
    )
  }
  return value
}

export const schedulerSignerProvider: FactoryProvider<KmsSigner> = {
  provide: SCHEDULER_SIGNER,
  inject: [TypedConfigService],
  useFactory: async (cfg: TypedConfigService): Promise<KmsSigner> => {
    const log = new Logger('SchedulerSigner')
    const provider = cfg.env.SCHEDULER_SIGNER_PROVIDER

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
      return new SoftwareSigner(requireSetting(cfg.env, 'SCHEDULER_PRIVATE_KEY') as `0x${string}`)
    }

    throw new Error(`unsupported SCHEDULER_SIGNER_PROVIDER: ${String(provider)}`)
  },
}
