import { Logger, type FactoryProvider } from '@nestjs/common'
import { AwsKmsSigner, SoftwareSigner, type KmsSigner } from '@strimz/signer'

import { TypedConfigService } from '../../config/index.js'

export const REFUND_SIGNER = Symbol('REFUND_SIGNER')

function required(value: string | undefined, key: string): string {
  if (!value) throw new Error(`${key} is required for the refund signer`)
  return value
}

/** Null outside production when no refund wallet is configured; refunds then wait. */
export const refundSignerProvider: FactoryProvider<KmsSigner | null> = {
  provide: REFUND_SIGNER,
  inject: [TypedConfigService],
  useFactory: async (cfg: TypedConfigService): Promise<KmsSigner | null> => {
    const log = new Logger('RefundSigner')
    const env = cfg.env
    if (env.REFUND_SIGNER_PROVIDER === 'aws-kms') {
      const signer = await AwsKmsSigner.connect({
        keyId: required(env.REFUND_KMS_KEY_ID, 'REFUND_KMS_KEY_ID'),
        expectedAddress: required(
          env.REFUND_SIGNER_ADDRESS,
          'REFUND_SIGNER_ADDRESS',
        ) as `0x${string}`,
        region: required(env.AWS_REGION, 'AWS_REGION'),
      })
      log.log(`refunds signed with AWS KMS key ${env.REFUND_KMS_KEY_ID}`)
      return signer
    }
    if (env.REFUND_SIGNER_PROVIDER === 'software') {
      return new SoftwareSigner(
        required(env.REFUND_PRIVATE_KEY, 'REFUND_PRIVATE_KEY') as `0x${string}`,
      )
    }
    log.warn('no refund wallet configured: fee refunds stay pending')
    return null
  },
}
