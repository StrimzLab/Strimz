import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { erc20Abi, formatUnits, getAddress } from 'viem'
import type {
  Merchant,
  MerchantBalanceView,
  UpdateMerchantInput,
  ChangeTierInput,
} from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { ChainRegistryService } from '../../infra/chain-registry/chain-registry.service.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { TypedConfigService } from '../../config/index.js'
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
    private readonly chain: ChainService,
    private readonly cfg: TypedConfigService,
  ) {}

  /**
   * Reads the merchant's on-chain USDC + EURC balances at their
   * configured payout address. This is a pure RPC read — Strimz is
   * non-custodial, so "balance" means "what the chain says about the
   * merchant's own wallet." The withdraw page in apps/web uses this
   * to render current balances before the merchant signs a transfer.
   *
   * `canSignFromDashboard` compares payoutAddress with walletAddress
   * (the Privy embedded wallet). When they match, the dashboard can
   * open a Privy transaction; when they differ (payoutAddress is a
   * multisig, treasury, etc.), the dashboard falls back to "copy the
   * address, move funds from your external wallet."
   */
  async getBalance(id: string): Promise<MerchantBalanceView> {
    const merchant = await this.prisma.db.merchant.findUnique({
      where: { id },
      select: { payoutAddress: true, walletAddress: true, arcEnvironment: true },
    })
    if (!merchant) {
      throw new NotFoundException({ code: 'not_found', message: 'merchant not found' })
    }
    if (!merchant.payoutAddress) {
      return {
        payoutAddress: null,
        walletAddress: merchant.walletAddress,
        canSignFromDashboard: false,
        balances: [],
      }
    }

    if (!this.cfg.env.ARC_USDC_ADDRESS) {
      throw new NotFoundException({
        code: 'invalid_state',
        message: 'ARC_USDC_ADDRESS is not configured on this deployment',
      })
    }
    const usdc = getAddress(this.cfg.env.ARC_USDC_ADDRESS)
    const eurc = this.cfg.env.ARC_EURC_ADDRESS ? getAddress(this.cfg.env.ARC_EURC_ADDRESS) : null
    const owner = getAddress(merchant.payoutAddress)

    // Batch reads. Errors on one token (e.g. contract not deployed on
    // this network) shouldn't take the whole endpoint down — we
    // report a zero balance for that token instead.
    const reads: Array<Promise<bigint>> = [
      this.chain.client.readContract({
        address: usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [owner],
      }),
    ]
    if (eurc) {
      reads.push(
        this.chain.client.readContract({
          address: eurc,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [owner],
        }),
      )
    }
    const results = await Promise.allSettled(reads)
    const [usdcResult, eurcResult] = results

    const balances: MerchantBalanceView['balances'] = []
    if (usdcResult) balances.push(buildBalance('USDC', usdc, usdcResult))
    if (eurc && eurcResult) balances.push(buildBalance('EURC', eurc, eurcResult))

    return {
      payoutAddress: owner,
      walletAddress: merchant.walletAddress,
      canSignFromDashboard:
        !!merchant.walletAddress && getAddress(merchant.walletAddress) === owner,
      balances,
    }
  }

  // Fallthrough helpers appended at end of file.

  async findById(id: string): Promise<Merchant> {
    const m = await this.prisma.db.merchant.findUnique({ where: { id } })
    if (!m) throw new NotFoundException({ code: 'not_found', message: 'merchant not found' })
    return serialiseMerchant(m)
  }

  async update(id: string, input: UpdateMerchantInput): Promise<Merchant> {
    let metadata: unknown = input.metadata
    if (input.emailPrefs) {
      const existing = await this.prisma.db.merchant.findUniqueOrThrow({
        where: { id },
        select: { metadata: true },
      })
      const currentBag = (existing.metadata ?? {}) as Record<string, unknown>
      const currentPrefs = (currentBag.emailPrefs ?? {}) as Record<string, boolean>
      metadata = {
        ...currentBag,
        ...(input.metadata ?? {}),
        emailPrefs: { ...currentPrefs, ...input.emailPrefs },
      }
    }

    const updated = await this.prisma.db.merchant.update({
      where: { id },
      data: {
        businessName: input.businessName,
        payoutAddress: input.payoutAddress,
        defaultCurrency: input.defaultCurrency,
        websiteUrl: input.websiteUrl,
        logoUrl: input.logoUrl,
        countryCode: input.countryCode,
        metadata: metadata as never,
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
        logoUrl: input.logoUrl ?? null,
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

  async getPublicBrand(id: string): Promise<{
    id: string
    businessName: string
    logoUrl: string | null
    walletAddress: string | null
  }> {
    const row = await this.prisma.db.merchant.findUnique({
      where: { id },
      select: { id: true, businessName: true, logoUrl: true, walletAddress: true },
    })
    if (!row) {
      throw new NotFoundException({ code: 'not_found', message: 'merchant not found' })
    }
    return {
      id: row.id,
      businessName: row.businessName ?? 'Merchant',
      logoUrl: row.logoUrl ?? null,
      walletAddress: row.walletAddress ?? null,
    }
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

/**
 * Convert a `Promise.allSettled` result for a single ERC-20
 * `balanceOf` read into the wire shape apps/web expects. Uses the
 * currency's decimals (6 for USDC + EURC) for the human-friendly
 * display. A rejected read means the token isn't deployed on this
 * chain or the RPC hiccuped; we still return zero so the UI can render
 * without a special error case.
 */
function buildBalance(
  currency: 'USDC' | 'EURC',
  contractAddress: `0x${string}`,
  result: PromiseSettledResult<bigint>,
): MerchantBalanceView['balances'][number] {
  if (result.status === 'rejected') {
    return {
      currency,
      contractAddress,
      raw: '0',
      formatted: '0.00',
      decimals: 6,
    }
  }
  return {
    currency,
    contractAddress,
    raw: result.value.toString(),
    formatted: formatUnits(result.value, 6),
    decimals: 6,
  }
}
