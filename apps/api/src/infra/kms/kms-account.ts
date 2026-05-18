import {
  hashMessage,
  hashTypedData,
  keccak256,
  serializeTransaction,
  type Hex,
  type SerializeTransactionFn,
  type Signature,
  type SignableMessage,
  type TransactionSerializable,
  type TypedData,
  type TypedDataDefinition,
} from 'viem'
import { toAccount } from 'viem/accounts'

import type { KmsSigner } from './kms.types.js'

/**
 * Wrap a `KmsSigner` in a viem account.
 *
 * The KMS layer only knows how to sign a 32-byte digest. viem expects
 * an account that can sign three message classes — EIP-191 personal
 * messages, EIP-712 typed-data, and raw transactions — each with its
 * own digest derivation. This factory does that derivation locally
 * (using viem's canonical helpers) and delegates the actual scalar
 * multiplication to the underlying signer.
 *
 * The wrapped account is interchangeable with any other viem account:
 * pass it to `createWalletClient({ account })` and the downstream code
 * cannot tell whether the key lives in process memory, a cloud KMS, or
 * anywhere else.
 */
export function toKmsAccount(signer: KmsSigner) {
  return toAccount({
    address: signer.address,

    async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
      // EIP-191: `keccak256("\x19Ethereum Signed Message:\n" + len + msg)`.
      const digest = hashMessage(message)
      return signer.signDigest(digest)
    },

    async signTypedData<
      const typedData extends TypedData | Record<string, unknown>,
      primaryType extends keyof typedData | 'EIP712Domain' = keyof typedData,
    >(parameters: TypedDataDefinition<typedData, primaryType>): Promise<Hex> {
      // EIP-712: `keccak256("\x19\x01" || domainSeparator || structHash)`.
      const digest = hashTypedData(parameters)
      return signer.signDigest(digest)
    },

    async signTransaction<TSerializable extends TransactionSerializable>(
      transaction: TSerializable,
      options?: { serializer?: SerializeTransactionFn<TSerializable> },
    ): Promise<Hex> {
      const serializer = options?.serializer ?? serializeTransaction
      // Serialise WITHOUT a signature to produce the message that gets
      // signed, then keccak256 it. `SerializeTransactionFn` is typed as
      // `MaybePromise<Hex>`; the stock viem serializer is sync but we
      // `await` so custom async serializers also work.
      const unsigned = await serializer(transaction)
      const digest = keccak256(unsigned)
      const sigHex = await signer.signDigest(digest)
      // viem's `parseSignature` moved/was renamed across 2.x versions;
      // splitting the 65-byte hex manually is both stable across
      // versions and trivially correct (no imports to track).
      const signature = sigHexToSignature(sigHex)
      return serializer(transaction, signature)
    },
  })
}

/**
 * Split a 65-byte canonical Ethereum signature `0x<r:32><s:32><v:1>`
 * into the `{ r, s, v, yParity }` shape viem expects when re-serialising
 * a transaction with a signature.
 */
function sigHexToSignature(sigHex: Hex): Signature {
  if (!/^0x[0-9a-fA-F]{130}$/u.test(sigHex)) {
    throw new Error(`expected 65-byte hex signature, got ${sigHex.length} chars`)
  }
  const r = `0x${sigHex.slice(2, 66)}` as Hex
  const s = `0x${sigHex.slice(66, 130)}` as Hex
  const v = BigInt(parseInt(sigHex.slice(130, 132), 16))
  if (v !== 27n && v !== 28n) {
    throw new Error(`unexpected v value ${v}; canonical software signers should emit 27 or 28`)
  }
  return { r, s, v, yParity: v === 27n ? 0 : 1 }
}
