import { describe, expect, it } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import { getAddress, type Hex } from 'viem'

import {
  normalizeSafeSignature,
  packSignatures,
  recoverSafeSigner,
  safeTxHash,
  safeTypedData,
  type SafeTx,
} from '../../../../src/modules/safe/safe-tx.js'

// The testnet Safe (v1.4.1) returned this from its own getTransactionHash for the same inputs.
const TESTNET_SAFE = '0xe38788afb172c1a7bb01feec5db0e3b21df301d7'
const ARC_TESTNET = 5042002
const pauseTx: SafeTx = {
  to: '0x00000000000000000000000000000000000000a1',
  value: 0n,
  data: '0x8456cb59',
  operation: 0,
  nonce: 7n,
}

const alice = privateKeyToAccount(`0x${'11'.repeat(32)}`)
const bob = privateKeyToAccount(`0x${'22'.repeat(32)}`)

const sign = (account: typeof alice, tx: SafeTx = pauseTx) =>
  account.signTypedData(safeTypedData(ARC_TESTNET, TESTNET_SAFE, tx))

describe('safeTxHash', () => {
  it('matches the Safe contract', () => {
    expect(safeTxHash(ARC_TESTNET, TESTNET_SAFE, pauseTx)).toBe(
      '0x2c7d7187370b99a388818adac9ca585b68823e533bef81a2f61af8e87fd6e50c',
    )
  })

  it('never lets the Safe refund gas', () => {
    const { message } = safeTypedData(ARC_TESTNET, TESTNET_SAFE, pauseTx)
    expect(message).toMatchObject({
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: '0x0000000000000000000000000000000000000000',
      refundReceiver: '0x0000000000000000000000000000000000000000',
    })
  })
})

describe('recoverSafeSigner', () => {
  it('finds who signed the typed data', async () => {
    const signature = await sign(alice)
    await expect(recoverSafeSigner(ARC_TESTNET, TESTNET_SAFE, pauseTx, signature)).resolves.toBe(
      alice.address,
    )
  })

  it('names someone else for a signature over a different nonce', async () => {
    const signature = await sign(alice, { ...pauseTx, nonce: 8n })
    await expect(
      recoverSafeSigner(ARC_TESTNET, TESTNET_SAFE, pauseTx, signature),
    ).resolves.not.toBe(alice.address)
  })

  it('refuses a signature that is not 65 bytes', async () => {
    await expect(recoverSafeSigner(ARC_TESTNET, TESTNET_SAFE, pauseTx, '0x1234')).rejects.toThrow(
      /65 bytes/u,
    )
  })

  it('refuses eth_sign style signatures', async () => {
    const signature = await sign(alice)
    const ethSign = `${signature.slice(0, 130)}${(0x1f).toString(16)}` as Hex
    await expect(recoverSafeSigner(ARC_TESTNET, TESTNET_SAFE, pauseTx, ethSign)).rejects.toThrow(
      /typed-data/u,
    )
  })
})

describe('normalizeSafeSignature', () => {
  it('turns a hardware wallet v of 0 or 1 into 27 or 28', async () => {
    const signature = await sign(alice)
    const v = parseInt(signature.slice(130), 16)
    const raw = `${signature.slice(0, 130)}0${v - 27}` as Hex
    expect(normalizeSafeSignature(raw)).toBe(signature)
    await expect(recoverSafeSigner(ARC_TESTNET, TESTNET_SAFE, pauseTx, raw)).resolves.toBe(
      alice.address,
    )
  })
})

describe('packSignatures', () => {
  it('orders signatures by signer address, as the Safe requires', async () => {
    const a = await sign(alice)
    const b = await sign(bob)
    const packed = packSignatures([
      { signer: getAddress(bob.address), signature: b },
      { signer: getAddress(alice.address), signature: a },
    ])
    const [first, second] = BigInt(alice.address) < BigInt(bob.address) ? [a, b] : [b, a]
    expect(packed).toBe(`${first}${second.slice(2)}`)
  })
})
