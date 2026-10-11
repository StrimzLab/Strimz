import {
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
  type GetPublicKeyCommandOutput,
  type SignCommandOutput,
} from '@aws-sdk/client-kms'
import {
  hexToBytes,
  isAddressEqual,
  numberToHex,
  recoverAddress,
  serializeSignature,
  type Address,
  type Hex,
} from 'viem'
import { publicKeyToAddress } from 'viem/accounts'

import { decodeEcdsaSignature, decodeUncompressedPublicKey } from './der.js'
import type { KmsSigner } from './kms-signer.js'

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
const SECP256K1_HALF_N = SECP256K1_N / 2n

export interface AwsKmsClient {
  send(command: GetPublicKeyCommand): Promise<GetPublicKeyCommandOutput>
  send(command: SignCommand): Promise<SignCommandOutput>
}

export interface AwsKmsSignerOptions {
  keyId: string
  expectedAddress: Address
  client: AwsKmsClient
}

export class AwsKmsSigner implements KmsSigner {
  private constructor(
    public readonly address: Address,
    private readonly keyId: string,
    private readonly client: AwsKmsClient,
  ) {}

  static connect(options: Omit<AwsKmsSignerOptions, 'client'> & { region: string }) {
    return AwsKmsSigner.create({
      keyId: options.keyId,
      expectedAddress: options.expectedAddress,
      client: new KMSClient({ region: options.region }),
    })
  }

  static async create({ keyId, expectedAddress, client }: AwsKmsSignerOptions) {
    const key = await client.send(new GetPublicKeyCommand({ KeyId: keyId }))
    if (key.KeySpec !== 'ECC_SECG_P256K1') {
      throw new Error(
        `AWS KMS key ${keyId} has key spec ${String(key.KeySpec)}; expected ECC_SECG_P256K1`,
      )
    }
    if (key.KeyUsage !== 'SIGN_VERIFY') {
      throw new Error(
        `AWS KMS key ${keyId} has key usage ${String(key.KeyUsage)}; expected SIGN_VERIFY`,
      )
    }
    if (!key.PublicKey) throw new Error(`AWS KMS key ${keyId} returned no public key`)
    const address = publicKeyToAddress(decodeUncompressedPublicKey(key.PublicKey))
    if (!isAddressEqual(address, expectedAddress)) {
      throw new Error(
        `AWS KMS key ${keyId} signs as ${address}, not the configured ${expectedAddress}`,
      )
    }
    return new AwsKmsSigner(address, keyId, client)
  }

  async signDigest(digest: Hex): Promise<Hex> {
    const message = hexToBytes(digest)
    if (message.length !== 32) {
      throw new Error(`AWS KMS signs 32 bytes digests; got ${message.length} bytes`)
    }
    const output = await this.client.send(
      new SignCommand({
        KeyId: this.keyId,
        Message: message,
        MessageType: 'DIGEST',
        SigningAlgorithm: 'ECDSA_SHA_256',
      }),
    )
    if (!output.Signature) throw new Error(`AWS KMS key ${this.keyId} returned no signature`)

    const { r, s } = decodeEcdsaSignature(output.Signature)
    if (r === 0n || r >= SECP256K1_N || s === 0n || s >= SECP256K1_N) {
      throw new Error(`AWS KMS key ${this.keyId} returned a signature outside the curve order`)
    }
    const low = {
      r: numberToHex(r, { size: 32 }),
      s: numberToHex(s > SECP256K1_HALF_N ? SECP256K1_N - s : s, { size: 32 }),
    }
    for (const yParity of [0, 1]) {
      const signature = { ...low, yParity }
      if (isAddressEqual(await recoverAddress({ hash: digest, signature }), this.address)) {
        return serializeSignature(signature)
      }
    }
    throw new Error(
      `AWS KMS key ${this.keyId} returned a signature that does not recover to ${this.address}`,
    )
  }
}
