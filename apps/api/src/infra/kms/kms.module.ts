import { Global, Logger, Module, type FactoryProvider } from '@nestjs/common'
import { AwsKmsSigner, SoftwareSigner, type KmsSigner } from '@strimz/signer'

import { TypedConfigService, type Env } from '../../config/index.js'
import { KMS_SIGNER } from './kms.tokens.js'

/**
 * Provider factory for the KMS layer.
 *
 * Selects the concrete signer at module-construction time from
 * `KMS_PROVIDER`. The contract is intentionally narrow — the rest of
 * the app depends only on the `KMS_SIGNER` token and never imports a
 * concrete provider class.
 *
 * Current providers:
 *  - `software`: secp256k1 key in process memory. Dev, and production on
 *    testnet with an explicit key. Refused in production on mainnet.
 *
 * Future providers (drop in against the same interface):
 *  - `gcp-kms`: GCP Cloud KMS hardware-backed signing.
 *  - `vault-transit`: HashiCorp Vault Transit hardware-backed signing.
 */
const kmsSignerProvider: FactoryProvider<KmsSigner> = {
  provide: KMS_SIGNER,
  inject: [TypedConfigService],
  useFactory: async (cfg: TypedConfigService): Promise<KmsSigner> => {
    const log = new Logger('KmsModule')
    const provider = cfg.env.KMS_PROVIDER

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
        // Testnet only: ADR-2026-11-13-testnet-software-signer. Mainnet waits on #455.
        if (cfg.env.ARC_ENVIRONMENT !== 'testnet') {
          throw new Error(
            'KMS: KMS_PROVIDER=software keeps the relayer key in process memory and is refused ' +
              'in production on mainnet. Set KMS_PROVIDER=aws-kms (see docs/runbooks/kms-signers.md).',
          )
        }
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
  key: 'KMS_AWS_KEY_ID' | 'KMS_SIGNER_ADDRESS' | 'AWS_REGION',
): string {
  const value = env[key]
  if (!value) throw new Error(`KMS: ${key} is required when KMS_PROVIDER=aws-kms`)
  return value
}

@Global()
@Module({
  providers: [kmsSignerProvider],
  exports: [KMS_SIGNER],
})
export class KmsModule {}
