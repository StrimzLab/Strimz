import { describe, expect, it } from 'vitest'
import {
  hashMessage,
  hashTypedData,
  keccak256,
  parseTransaction,
  recoverAddress,
  recoverMessageAddress,
  recoverTypedDataAddress,
  serializeTransaction,
} from 'viem'
import { generatePrivateKey } from 'viem/accounts'

import { SoftwareKmsProvider } from '../../../../src/infra/kms/software-kms.provider.js'
import { toKmsAccount } from '../../../../src/infra/kms/kms-account.js'

describe('toKmsAccount', () => {
  it('produces an EIP-191 signature recoverable to the signer', async () => {
    const signer = new SoftwareKmsProvider(generatePrivateKey())
    const account = toKmsAccount(signer)
    const message = 'strimz handshake'
    const sig = await account.signMessage({ message })
    const recovered = await recoverMessageAddress({ message, signature: sig })
    expect(recovered.toLowerCase()).toBe(signer.address.toLowerCase())
    // Also verify the digest path matches the explicit hashMessage helper.
    const recoveredViaDigest = await recoverAddress({ hash: hashMessage(message), signature: sig })
    expect(recoveredViaDigest.toLowerCase()).toBe(signer.address.toLowerCase())
  })

  it('produces an EIP-712 signature recoverable to the signer', async () => {
    const signer = new SoftwareKmsProvider(generatePrivateKey())
    const account = toKmsAccount(signer)
    const typedData = {
      domain: { name: 'Strimz', version: '1', chainId: 5042002 },
      types: {
        ChargeRequest: [
          { name: 'merchant', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
      primaryType: 'ChargeRequest' as const,
      message: { merchant: signer.address, amount: 1_000_000n },
    }
    const sig = await account.signTypedData(typedData)
    const recovered = await recoverTypedDataAddress({ ...typedData, signature: sig })
    expect(recovered.toLowerCase()).toBe(signer.address.toLowerCase())
    // Digest-path consistency:
    const recoveredViaDigest = await recoverAddress({
      hash: hashTypedData(typedData),
      signature: sig,
    })
    expect(recoveredViaDigest.toLowerCase()).toBe(signer.address.toLowerCase())
  })

  it('produces a signed transaction that decodes back to the same fields', async () => {
    const signer = new SoftwareKmsProvider(generatePrivateKey())
    const account = toKmsAccount(signer)
    const tx = {
      chainId: 5042002,
      type: 'eip1559' as const,
      nonce: 1,
      to: '0x000000000000000000000000000000000000dEaD' as `0x${string}`,
      // Non-zero so the round-trip preserves the field (viem's
      // `parseTransaction` omits zero-valued numeric fields by design).
      value: 1_000_000n,
      gas: 21000n,
      maxFeePerGas: 25_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      data: '0xdeadbeef' as `0x${string}`,
    }
    const raw = await account.signTransaction(tx)
    const decoded = parseTransaction(raw)
    expect(decoded.chainId).toBe(tx.chainId)
    expect(decoded.nonce).toBe(tx.nonce)
    expect(decoded.to).toBe(tx.to.toLowerCase() as `0x${string}`)
    expect(decoded.value).toBe(tx.value)
    expect(decoded.gas).toBe(tx.gas)
    expect(decoded.maxFeePerGas).toBe(tx.maxFeePerGas)
    expect(decoded.maxPriorityFeePerGas).toBe(tx.maxPriorityFeePerGas)
    expect(decoded.data).toBe(tx.data)

    // The signature on the raw tx must recover to the signer.
    // viem's `parseTransaction` returns the embedded `r`, `s`, `v` /
    // `yParity`; the tx hash signed is keccak256 of the unsigned serialised tx.
    const unsigned = serializeTransaction({ ...tx })
    const digest = keccak256(unsigned)
    const sig =
      `0x${decoded.r!.replace(/^0x/, '').padStart(64, '0')}${decoded.s!.replace(/^0x/, '').padStart(64, '0')}${(decoded.yParity! + 27).toString(16).padStart(2, '0')}` as `0x${string}`
    const recovered = await recoverAddress({ hash: digest, signature: sig })
    expect(recovered.toLowerCase()).toBe(signer.address.toLowerCase())
  })
})
