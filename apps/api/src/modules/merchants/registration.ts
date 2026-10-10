import {
  decodeEventLog,
  encodeFunctionData,
  hexToBigInt,
  type Hex,
  type TransactionReceipt,
} from 'viem'
import { DEFAULT_TIER, effectiveFeeBps } from '@strimz/shared-config'

import { registerMerchantAbi } from './registry.abi.js'

/** Required gas budget for `registerMerchant`. A simple SSTORE-heavy
 *  write fits comfortably under 200k; 300k leaves headroom for an
 *  occasionally pricey storage-slot write. */
export const REGISTER_MERCHANT_GAS_LIMIT = 300_000n

/** Default parent merchant id — `0` means "no parent" in the registry's
 *  sub-tenancy model. Sub-tenanting will land as a separate feature. */
const NO_PARENT = 0n

export interface RegistrationCandidate {
  walletAddress: string | null
  payoutAddress: string | null
  onboardingCompleted: boolean
}

export function registrationGaps(m: RegistrationCandidate): string[] {
  const gaps: string[] = []
  if (!m.walletAddress) gaps.push('walletAddress')
  if (!m.payoutAddress) gaps.push('payoutAddress')
  if (!m.onboardingCompleted) gaps.push('onboardingCompleted')
  return gaps
}

function defaultRegistrationFeeBps(): number {
  const feeBps = effectiveFeeBps(DEFAULT_TIER, 'one_shot')
  if (feeBps === null) {
    throw new Error(`default tier ${DEFAULT_TIER} has no fixed one-shot fee`)
  }
  return feeBps
}

export function registerMerchantCallData(m: RegistrationCandidate): Hex {
  return encodeFunctionData({
    abi: registerMerchantAbi,
    functionName: 'registerMerchant',
    args: [m.walletAddress as Hex, m.payoutAddress as Hex, defaultRegistrationFeeBps(), NO_PARENT],
  })
}

export function decodeMerchantRegisteredId(
  receipt: Pick<TransactionReceipt, 'logs' | 'transactionHash'>,
  registryAddress: Hex,
): bigint {
  for (const logEntry of receipt.logs) {
    if (logEntry.address.toLowerCase() !== registryAddress.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi: registerMerchantAbi,
        data: logEntry.data,
        topics: logEntry.topics,
      })
      if (decoded.eventName === 'MerchantRegistered') {
        return decoded.args.merchantId
      }
    } catch {
      // Not the event we want — skip.
    }
  }

  // Fall back to topic decode in case the ABI matcher missed (e.g.
  // proxy re-encoding). The merchantId is indexed → topics[1].
  const fallback = receipt.logs.find(
    (l) => l.address.toLowerCase() === registryAddress.toLowerCase() && l.topics.length >= 2,
  )
  if (fallback?.topics[1]) {
    return hexToBigInt(fallback.topics[1])
  }

  throw new Error(`MerchantRegistered event not found in tx ${receipt.transactionHash}`)
}
