import { describe, expect, it } from 'vitest'
import { keccak256, recoverAddress } from 'viem'
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'

import { SoftwareKmsProvider } from '../../../../src/infra/kms/software-kms.provider.js'

describe('SoftwareKmsProvider', () => {
  it('uses the configured private key and exposes the matching address', () => {
    const pk = generatePrivateKey()
    const expected = privateKeyToAddress(pk)
    const signer = new SoftwareKmsProvider(pk)
    expect(signer.address).toBe(expected)
  })

  it('generates an ephemeral key when none is provided', () => {
    const a = new SoftwareKmsProvider()
    const b = new SoftwareKmsProvider()
    expect(a.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(b.address).not.toBe(a.address) // randomness check
  })

  it('produces signatures that recover to the signer address', async () => {
    const pk = generatePrivateKey()
    const signer = new SoftwareKmsProvider(pk)
    const digest = keccak256('0xdeadbeef')
    const signature = await signer.signDigest(digest)
    const recovered = await recoverAddress({ hash: digest, signature })
    expect(recovered.toLowerCase()).toBe(signer.address.toLowerCase())
  })

  it('produces a 65-byte signature in canonical hex form', async () => {
    const signer = new SoftwareKmsProvider()
    const digest = keccak256('0x01')
    const signature = await signer.signDigest(digest)
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/)
  })

  it('is deterministic for a fixed key + digest (RFC-6979)', async () => {
    const pk = generatePrivateKey()
    const signer = new SoftwareKmsProvider(pk)
    const digest = keccak256('0xa0a0')
    const a = await signer.signDigest(digest)
    const b = await signer.signDigest(digest)
    expect(a).toBe(b)
  })
})
