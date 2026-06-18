/**
 * Smart-wallet address derivation for Strimz merchants.
 *
 * A Soroban smart wallet is a contract deployed at an address derived
 * deterministically from (deployer, salt). We use SHA-256 of the
 * WebAuthn credential id as the salt, so a passkey is durably bound
 * to one wallet contract address. Knowing the address before the
 * contract is deployed lets the merchant capture it at onboarding;
 * actual deploy is lazy — happens on the first incoming payment in M5.
 *
 * The math here matches the Soroban host's `HashIdPreimageContractId`
 * formula, so the address this returns is the same one the contract
 * will land at when `CreateContractV2` is invoked. See:
 *   https://developers.stellar.org/docs/learn/smart-contract-internals/contract-lifecycle
 *
 * Implementation note: we use `@stellar/stellar-sdk`'s XDR types
 * directly. No intermediate library — Strimz owns this code top to
 * bottom.
 */

import { Address, StrKey, hash, xdr } from '@stellar/stellar-sdk'

import { NETWORK_PASSPHRASE } from './network.js'
import type { DeriveMerchantWalletInput } from './types.js'

/**
 * Returns the deterministic Soroban contract address (`C…` Strkey)
 * the merchant's smart wallet will deploy to. Pure function; no
 * network I/O. Cheap enough to call on every render if needed.
 *
 * Same input → same address, forever. Once we capture this at
 * onboarding it is durably the merchant's Stellar wallet identifier.
 */
export function deriveMerchantWalletAddress(input: DeriveMerchantWalletInput): string {
  const networkId = hash(Buffer.from(NETWORK_PASSPHRASE[input.network]))

  const contractIdPreimage = xdr.ContractIdPreimage.contractIdPreimageFromAddress(
    new xdr.ContractIdPreimageFromAddress({
      address: Address.fromString(input.deployer).toScAddress(),
      // The credential id can be any length; the host expects a 32-byte
      // salt, so we hash it. SHA-256 is the canonical choice and lines
      // up with what existing passkey-kit-derived wallets use, keeping
      // address derivation interoperable.
      salt: hash(Buffer.from(input.credentialId)),
    }),
  )

  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({ networkId, contractIdPreimage }),
  )

  return StrKey.encodeContract(hash(preimage.toXDR()))
}
