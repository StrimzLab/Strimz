import { Global, Logger, Module, type FactoryProvider } from '@nestjs/common'

import { TypedConfigService } from '../../config/index.js'
import { SoftwareKmsProvider } from './software-kms.provider.js'
import { KMS_SIGNER } from './kms.tokens.js'
import type { KmsSigner } from './kms.types.js'

/**
 * Provider factory for the KMS layer.
 *
 * Selects the concrete signer at module-construction time from
 * `KMS_PROVIDER`. The contract is intentionally narrow — the rest of
 * the app depends only on the `KMS_SIGNER` token and never imports a
 * concrete provider class.
 *
 * Current providers:
 *  - `software`: secp256k1 key in process memory. Suitable for dev,
 *    testnet, and early production with an explicit key. Refuses to
 *    start in production with an auto-generated ephemeral key.
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

    if (provider === 'software') {
      const keyFromEnv = cfg.env.KMS_SOFTWARE_PRIVATE_KEY as `0x${string}` | undefined
      if (cfg.env.NODE_ENV === 'production' && !keyFromEnv) {
        throw new Error(
          'KMS: refusing to auto-generate an ephemeral key in production. ' +
            'Set KMS_SOFTWARE_PRIVATE_KEY explicitly via your hosting provider\'s ' +
            'encrypted secrets store, or configure a hardware-backed provider.',
        )
      }
      if (cfg.env.NODE_ENV === 'production') {
        log.warn(
          'KMS: running software signer in production. Key lives in process memory. ' +
            'Graduate to a hardware-backed provider (GCP Cloud KMS, Vault Transit) ' +
            'when funded or when monthly merchant volume exceeds ~$50k.',
        )
      }
      return new SoftwareKmsProvider(keyFromEnv)
    }

    // Exhaustiveness check — Zod has already validated the enum, but a
    // future value added without a handler here must fail loudly.
    throw new Error(`unsupported KMS_PROVIDER: ${String(provider)}`)
  },
}

@Global()
@Module({
  providers: [kmsSignerProvider],
  exports: [KMS_SIGNER],
})
export class KmsModule {}
