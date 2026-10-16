import {
  GetPublicKeyCommand,
  KMSClient,
  type SignCommand,
  type GetPublicKeyCommandOutput,
  type KeySpec,
  type SignCommandOutput,
} from '@aws-sdk/client-kms'
import { describe, expect, it } from 'vitest'
import {
  bytesToHex,
  hexToBigInt,
  hexToBytes,
  keccak256,
  parseTransaction,
  recoverAddress,
  serializeTransaction,
  type Hex,
} from 'viem'
import { privateKeyToAccount, sign } from 'viem/accounts'

import { AwsKmsSigner, toKmsAccount, type AwsKmsClient } from '../src/index.js'

const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
const SECP256K1_SPKI_PREFIX = '3056301006072a8648ce3d020106052b8104000a034200'
const KMS_KEY = '0x00000000000000000000000000000000000000000000000000000000000000d4' as const
const OTHER_KEY = '0x00000000000000000000000000000000000000000000000000000000000000e5' as const
const KEY_ID = 'alias/strimz-testnet-relayer'

function derInteger(value: bigint): string {
  let hex = value.toString(16)
  if (hex.length % 2 === 1) hex = `0${hex}`
  if (Number.parseInt(hex.slice(0, 2), 16) >= 0x80) hex = `00${hex}`
  return `02${(hex.length / 2).toString(16).padStart(2, '0')}${hex}`
}

function derSignature(r: bigint, s: bigint): Uint8Array {
  const body = `${derInteger(r)}${derInteger(s)}`
  return hexToBytes(`0x30${(body.length / 2).toString(16).padStart(2, '0')}${body}`)
}

class FakeKms implements AwsKmsClient {
  readonly signRequests: SignCommand['input'][] = []
  keySpec: KeySpec = 'ECC_SECG_P256K1'
  highS = false
  signWith: Hex
  signature: Uint8Array | undefined

  constructor(readonly privateKey: Hex) {
    this.signWith = privateKey
  }

  send(command: GetPublicKeyCommand): Promise<GetPublicKeyCommandOutput>
  send(command: SignCommand): Promise<SignCommandOutput>
  async send(
    command: GetPublicKeyCommand | SignCommand,
  ): Promise<GetPublicKeyCommandOutput | SignCommandOutput> {
    if (command instanceof GetPublicKeyCommand) {
      const point = privateKeyToAccount(this.privateKey).publicKey.slice(2)
      return {
        $metadata: {},
        KeyId: command.input.KeyId,
        KeySpec: this.keySpec,
        KeyUsage: 'SIGN_VERIFY',
        PublicKey: hexToBytes(`0x${SECP256K1_SPKI_PREFIX}${point}`),
      }
    }
    this.signRequests.push(command.input)
    if (this.signature) return { $metadata: {}, Signature: this.signature }
    const message = command.input.Message
    if (!message) throw new Error('fake KMS: Sign without a Message')
    const sig = await sign({ hash: bytesToHex(message), privateKey: this.signWith })
    const s = hexToBigInt(sig.s)
    return {
      $metadata: {},
      KeyId: command.input.KeyId,
      Signature: derSignature(hexToBigInt(sig.r), this.highS ? SECP256K1_N - s : s),
    }
  }
}

const kmsAddress = privateKeyToAccount(KMS_KEY).address

function create(kms: FakeKms, expectedAddress: Hex = kmsAddress) {
  return AwsKmsSigner.create({ keyId: KEY_ID, expectedAddress, client: kms })
}

describe('AwsKmsSigner', () => {
  it('takes its address from the KMS public key', async () => {
    const signer = await create(new FakeKms(KMS_KEY), kmsAddress.toLowerCase() as Hex)
    expect(signer.address).toBe(kmsAddress)
  })

  it('refuses a key whose address is not the configured one', async () => {
    const other = privateKeyToAccount(OTHER_KEY).address
    await expect(create(new FakeKms(KMS_KEY), other)).rejects.toThrow(other)
  })

  it('refuses a key that is not secp256k1', async () => {
    const kms = new FakeKms(KMS_KEY)
    kms.keySpec = 'ECC_NIST_P256'
    await expect(create(kms)).rejects.toThrow(/ECC_SECG_P256K1/u)
  })

  it('asks KMS to sign the digest itself, not a hash of it', async () => {
    const kms = new FakeKms(KMS_KEY)
    const signer = await create(kms)
    const digest = keccak256('0xdeadbeef')
    await signer.signDigest(digest)
    expect(kms.signRequests).toEqual([
      {
        KeyId: KEY_ID,
        Message: hexToBytes(digest),
        MessageType: 'DIGEST',
        SigningAlgorithm: 'ECDSA_SHA_256',
      },
    ])
  })

  it('returns the same signature a local key would', async () => {
    const signer = await create(new FakeKms(KMS_KEY))
    const digest = keccak256('0x01')
    const expected = await sign({ hash: digest, privateKey: KMS_KEY, to: 'hex' })
    expect(await signer.signDigest(digest)).toBe(expected)
  })

  it('moves a high s into the lower half of the curve order', async () => {
    const kms = new FakeKms(KMS_KEY)
    kms.highS = true
    const signer = await create(kms)
    const digest = keccak256('0xa0a0')
    const signature = await signer.signDigest(digest)
    expect(hexToBigInt(`0x${signature.slice(66, 130)}`) <= SECP256K1_N / 2n).toBe(true)
    expect(await recoverAddress({ hash: digest, signature })).toBe(kmsAddress)
    expect(signature).toBe(await sign({ hash: digest, privateKey: KMS_KEY, to: 'hex' }))
  })

  it('fails when the signature does not recover to the key address', async () => {
    const kms = new FakeKms(KMS_KEY)
    const signer = await create(kms)
    kms.signWith = OTHER_KEY
    await expect(signer.signDigest(keccak256('0x02'))).rejects.toThrow(kmsAddress)
  })

  it('fails on a signature that is not DER', async () => {
    const kms = new FakeKms(KMS_KEY)
    const signer = await create(kms)
    kms.signature = hexToBytes(`0x${'11'.repeat(64)}`)
    await expect(signer.signDigest(keccak256('0x03'))).rejects.toThrow(/DER/u)
  })

  it('refuses a digest that is not 32 bytes', async () => {
    const signer = await create(new FakeKms(KMS_KEY))
    await expect(signer.signDigest('0xdeadbeef')).rejects.toThrow(/32 bytes/u)
  })

  it('signs transactions through the viem account adapter', async () => {
    const signer = await create(new FakeKms(KMS_KEY))
    const raw = await toKmsAccount(signer).signTransaction({
      type: 'eip1559',
      chainId: 5042002,
      nonce: 7,
      to: '0x000000000000000000000000000000000000dEaD',
      value: 0n,
      gas: 21000n,
      maxFeePerGas: 30n,
      maxPriorityFeePerGas: 1n,
    })
    const { r, s, yParity, ...unsigned } = parseTransaction(raw)
    if (!r || !s || yParity === undefined) throw new Error('signed transaction has no signature')
    expect(unsigned.nonce).toBe(7)
    const hash = keccak256(serializeTransaction(unsigned))
    expect(await recoverAddress({ hash, signature: { r, s, yParity } })).toBe(kmsAddress)
  })

  it('accepts the AWS SDK client as its client', () => {
    const client: AwsKmsClient = new KMSClient({ region: 'us-east-1' })
    expect(client).toBeInstanceOf(KMSClient)
  })
})
