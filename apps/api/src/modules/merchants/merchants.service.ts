import { Injectable, NotFoundException } from '@nestjs/common'
import type { Merchant, UpdateMerchantInput, ChangeTierInput } from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { serialiseMerchant } from './merchants.serialiser.js'
import type { OnboardInput } from './merchants.dto.js'

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

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
   * One-shot self-attested onboarding form. Captures business name, sector,
   * country, etc. and flips `onboardingCompleted` so the dashboard exits
   * the onboarding wizard.
   */
  async onboard(id: string, input: OnboardInput): Promise<Merchant> {
    const updated = await this.prisma.db.merchant.update({
      where: { id },
      data: {
        businessName: input.businessName,
        businessSector: input.businessSector,
        countryCode: input.countryCode,
        websiteUrl: input.websiteUrl ?? null,
        phone: input.phone ?? null,
        payoutAddress: input.payoutAddress,
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
