import type { PaymentCurrency } from '@strimz/shared-types'
import { TypedConfigService } from '../../config/index.js'

/**
 * Resolve a logical currency to the on-chain ERC-20 contract address
 * on the configured Arc chain.
 *
 * Lives in the payment-sessions module because that's the first
 * consumer; if/when other modules need the same mapping the helper
 * will graduate to `infra/chain/` (or shared-config) — for now,
 * co-locating it keeps the dependency tree tidy.
 */
export function tokenAddressForCurrency(
  cfg: TypedConfigService,
  currency: PaymentCurrency,
): `0x${string}` | null {
  const addr = currency === 'USDC' ? cfg.env.ARC_USDC_ADDRESS : cfg.env.ARC_EURC_ADDRESS
  if (!addr) return null
  return addr.toLowerCase() as `0x${string}`
}
