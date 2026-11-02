import { isContractAccount } from '@/lib/checkout-result'

type Hex = `0x${string}`

// Some wallets return v as 0/1. The token and the contracts need 27/28 for an
// ordinary wallet; a smart wallet's signature is checked by the wallet itself,
// so it goes through untouched.
export function walletSignature(signature: Hex, payerCode: string | null | undefined): Hex {
  if (isContractAccount(payerCode) || signature.length !== 132) return signature
  const v = parseInt(signature.slice(130), 16)
  if (v >= 27) return signature
  return `${signature.slice(0, 130)}${(v + 27).toString(16)}` as Hex
}
