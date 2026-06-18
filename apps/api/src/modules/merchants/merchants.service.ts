import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Merchant, UpdateMerchantInput, ChangeTierInput } from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { ChainRegistryService } from '../../infra/chain-registry/chain-registry.service.js'
import { serialiseMerchant } from './merchants.serialiser.js'
import type { OnboardInput } from './merchants.dto.js'

/**
 * Stellar address shape (G-account or C-contract): base32 Strkey,
 * exactly 56 chars. The chain registry's StellarChainAdapter (M5)
 * will replace this with a proper StrKey checksum validator; the
 * regex covers the structural check until that lands.
 */
const STELLAR_ADDRESS_REGEX = /^[GC][A-Z2-7]{55}$/

@Injectable()
export class MerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chains: ChainRegistryService,
  ) {}

  async findById(id: string): Promise<Merchant> {
    const m = await this.prisma.db.merchant.findUnique({ where: { id } })
    if (!m) throw new NotFoundException({ code: 'not_found', message: 'merchant not found' })
    return serialiseMerchant(m)
  }

  async update(id: string, input: UpdateMerchantInput): Promise<Merchant> {
    const updated = await this.prisma.db.merchant.update({
      where: { id },
      data: {
        businessName: input.businessName,
        payoutAddress: input.payoutAddress,
        defaultCurrency: input.defaultCurrency,
        websiteUrl: input.websiteUrl,
        logoUrl: input.logoUrl,
        countryCode: input.countryCode,
        metadata: input.metadata,
      },
    })
    return serialiseMerchant(updated)
  }

  /**
   * One-shot self-attested onboarding form. Captures business profile +
   * per-chain payout addresses, flips `onboardingCompleted` so the
   * dashboard exits the wizard, and seeds `supportedChains` from the
   * payout map keys.
   *
   * Address validation runs per chain via the registry — `evm:*`
   * adapters use viem's checksummed-EVM check, Stellar entries fall
   * back to a Strkey regex until the M5 adapter ships.
   *
   * The legacy `payoutAddress` column is populated from the first EVM
   * entry (if any) so the on-chain merchant-registration flow continues
   * to work without a separate migration.
   */
  async onboard(id: string, input: OnboardInput): Promise<Merchant> {
    const chains = Object.keys(input.payoutAddresses)
    const normalised: Record<string, string> = {}

    for (const chainId of chains) {
      const address = input.payoutAddresses[chainId]
      if (!address) continue

      const adapter = this.chains.find(chainId)
      if (adapter) {
        if (!adapter.validateAddress(address)) {
          throw new BadRequestException({
            code: 'invalid_address',
            message: `"${address}" is not a valid address on ${chainId}`,
          })
        }
        normalised[chainId] = adapter.normaliseAddress(address)
        continue
      }

      // No adapter wired yet (Stellar pre-M5) — fall back to regex.
      if (chainId.startsWith('stellar:')) {
        if (!STELLAR_ADDRESS_REGEX.test(address)) {
          throw new BadRequestException({
            code: 'invalid_address',
            message: `"${address}" is not a valid Stellar G-account or C-contract address`,
          })
        }
        normalised[chainId] = address
        continue
      }

      // Unknown chain family — refuse.
      throw new BadRequestException({
        code: 'chain_not_supported',
        message: `chain "${chainId}" is not registered`,
      })
    }

    // Derive legacy payoutAddress from the first EVM entry (for the
    // on-chain registry registration flow, until M5 generalises that).
    const legacyEvmPayout = Object.entries(normalised).find(([c]) => c.startsWith('evm:'))?.[1]

    const updated = await this.prisma.db.merchant.update({
      where: { id },
      data: {
        businessName: input.businessName,
        businessSector: input.businessSector,
        countryCode: input.countryCode,
        websiteUrl: input.websiteUrl ?? null,
        phone: input.phone ?? null,
        payoutAddresses: normalised,
        supportedChains: Object.keys(normalised),
        ...(legacyEvmPayout ? { payoutAddress: legacyEvmPayout } : {}),
        defaultCurrency: input.defaultCurrency ?? 'USDC',
        onboardingCompleted: true,
      },
    })
    return serialiseMerchant(updated)
  }

  async changeTier(id: string, input: ChangeTierInput): Promise<Merchant> {
    const updated = await this.prisma.db.merchant.update({
      where: { id },
      data: { tier: input.tier },
    })
    return serialiseMerchant(updated)
  }

  /**
   * Live mode is gated on three checks:
   *   1) email verified (Privy)
   *   2) MFA enrolled (Privy)
   *   3) onboarding form completed (self-attested business info)
   *   4) payout address configured
   * Returns structured reasons so the dashboard can route to the right step.
   */
  async liveModeEligibility(id: string): Promise<{
    eligible: boolean
    reasons: { code: string; message: string }[]
  }> {
    const m = await this.prisma.db.merchant.findUnique({ where: { id } })
    if (!m) throw new NotFoundException({ code: 'not_found', message: 'merchant not found' })

    const reasons: { code: string; message: string }[] = []
    if (!m.emailVerified) {
      reasons.push({ code: 'email_unverified', message: 'Verify your email address.' })
    }
    if (!m.twoFactorEnabled) {
      reasons.push({
        code: 'mfa_required',
        message: 'Enable two-factor authentication in your account settings.',
      })
    }
    if (!m.onboardingCompleted) {
      reasons.push({
        code: 'onboarding_incomplete',
        message: 'Complete the business onboarding form.',
      })
    }
    if (!m.payoutAddress) {
      reasons.push({
        code: 'payout_address_missing',
        message: 'Set a payout wallet address.',
      })
    }
    return { eligible: reasons.length === 0, reasons }
  }
}
