import { Logger } from '@nestjs/common'
import { signatureToHex, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAddress, sign } from 'viem/accounts'

import type { KmsSigner } from './kms.types.js'

/**
 * Software signer — secp256k1 private key held in process memory,
 * signed via viem locally.
 *
 * Appropriate for development, CI, testnet, and early-stage production
 * where the signing key is the relayer (low-blast-radius: it can only
 * spend its own gas balance — it cannot steal merchant or payer funds,
 * since the on-chain contracts trust the payer's EIP-3009 / EIP-2612
 * signature rather than this signer).
 *
 * Production deployments MUST supply the key explicitly via env (kept
 * in the hosting provider's encrypted secrets vault — Fly secrets,
 * Vercel env, Railway secrets, etc.). The module factory refuses to
 * start in production with an auto-generated ephemeral key.
 *
 * Upgrade trigger: when monthly merchant volume crosses ~$50k OR when
 * the company is funded, swap to a hardware-backed provider (GCP Cloud
 * KMS, HashiCorp Vault Transit). The `KmsSigner` interface is
 * deliberately narrow so a replacement provider is one class file and
 * an env-var change — no call sites move.
 */
export class SoftwareKmsProvider implements KmsSigner {
  public readonly address: `0x${string}`

  private readonly log = new Logger(SoftwareKmsProvider.name)
  private readonly privateKey: `0x${string}`

  constructor(privateKeyHex?: `0x${string}`) {
    this.privateKey = privateKeyHex ?? generatePrivateKey()
    this.address = privateKeyToAddress(this.privateKey)

    if (!privateKeyHex) {
      this.log.warn(
        `software KMS: generated ephemeral key for ${this.address}. ` +
          `Fund this address from the Arc faucet, or set KMS_SOFTWARE_PRIVATE_KEY ` +
          `to pin it across restarts.`,
      )
    } else {
      this.log.log(`software KMS: using configured key for ${this.address}`)
    }
  }

  async signDigest(digest: Hex): Promise<Hex> {
    // viem's `sign` accepts a 32-byte hash and a 0x-prefixed private
    // key, returns the canonical low-s signature with `v` already
    // recovered. Output is wire-compatible with whatever future
    // hardware-backed providers we ship — call sites cannot tell which
    // implementation produced the signature.
    const sig = await sign({ hash: digest, privateKey: this.privateKey })
    return signatureToHex(sig)
  }
}
