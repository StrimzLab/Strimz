import { Logger, type FactoryProvider } from '@nestjs/common'
import {
  AwsKmsSigner,
  PrivyServerSigner,
  SoftwareSigner,
  type PrivyWalletApi,
  type TransactionSigner,
} from '@strimz/signer'

import { TypedConfigService } from '../../config/index.js'
import { PRIVY_WALLET_API } from '../privy-signer/privy-wallet-api.js'

export const REFUND_SIGNER = Symbol('REFUND_SIGNER')

function required(value: string | undefined, key: string): string {
  if (!value) throw new Error(`${key} is required for the refund signer`)
  return value
}

/** Null outside production when no refund wallet is configured; refunds then wait. */
export const refundSignerProvider = {
  provide: REFUND_SIGNER,
  inject: [TypedConfigService, PRIVY_WALLET_API],
  useFactory: async (
    cfg: TypedConfigService,
    privyApi: PrivyWalletApi | null,
  ): Promise<TransactionSigner | null> => {
    const log = new Logger('RefundSigner')
    const env = cfg.env
    if (env.REFUND_SIGNER_PROVIDER === 'privy') {
      if (!privyApi) throw new Error('the Privy wallet API is not configured')
      const walletId = required(env.PRIVY_REFUND_WALLET_ID, 'PRIVY_REFUND_WALLET_ID')
      const signer = await PrivyServerSigner.connect({
        api: privyApi,
        walletId,
        expectedAddress: required(
          env.REFUND_SIGNER_ADDRESS,
          'REFUND_SIGNER_ADDRESS',
        ) as `0x${string}`,
      })
      log.log(`refunds signed with Privy wallet ${walletId}`)
      return signer
    }
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
} satisfies FactoryProvider<TransactionSigner | null>
