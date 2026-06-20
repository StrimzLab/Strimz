/**
 * `StellarChainAdapter` — the Stellar family implementation of
 * `ChainAdapter`.
 *
 * M5a stable surface:
 *   - Identity (`chainId`, `family`, `capabilities`)
 *   - Strkey-backed address validation + canonicalisation
 *
 * Submission methods (`preparePayment`, `chargeSubscription`,
 * `refund`, `subscribeEvents`, `refreshAllowance`) throw
 * `AdapterNotImplementedError` until M5b–e land their respective
 * envelope-construction, relayer-submission, indexer, and dunning-lane
 * code. The deliberate "throw, don't no-op" stance matches the EVM
 * adapter's M2-era posture — a caller wiring in an unmoved method
 * during the transition sees a structured `adapter_not_implemented`
 * error rather than a silent return that pretends the call landed.
 */

import { rpc, Asset } from '@stellar/stellar-sdk'
import {
  AdapterNotImplementedError,
  InvalidAddressError,
  type ChainAdapter,
  type ChainCapabilities,
  type ChainEventHandlers,
  type ChainFamily,
  type ChargeSubscriptionInput,
  type PreparePaymentInput,
  type PreparePaymentResult,
  type PrepareEnrolmentInput,
  type PrepareEnrolmentResult,
  type RefreshAllowanceInput,
  type RefundInput,
  type RelaySubmission,
  type SignedEnrolmentBundle,
  type SignedPaymentBundle,
  type Unsubscribe,
} from '@strimz/chain-adapter'

import { isValidStellarPayoutAddress, normaliseStellarAddress } from './address.js'
import {
  assembleViaSimulation,
  buildEnrolmentInvocation,
  buildPaymentInvocation,
} from './builders.js'
import { STELLAR_CAPABILITIES } from './capabilities.js'
import type { StellarChainConfig } from './config.js'
import { NETWORK_PASSPHRASE } from './network.js'
import type { StellarRpcClient } from './rpc.js'

/**
 * Circle's USDC issuer accounts, per network. Used as a fallback when
 * `config.usdcSac` is unset — we derive the SAC contract id from the
 * `(code, issuer)` pair via `Asset.getContractId`, so the adapter
 * never needs the SAC string hard-coded.
 */
const USDC_ISSUER: Record<string, string> = {
  testnet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  pubnet: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
}

export class StellarChainAdapter implements ChainAdapter {
  readonly family: ChainFamily = 'stellar'
  readonly capabilities: ChainCapabilities = STELLAR_CAPABILITIES

  private rpcClient: StellarRpcClient | null

  constructor(
    private readonly config: StellarChainConfig,
    rpcClient?: StellarRpcClient,
  ) {
    // Tests inject a mock; production lazily constructs a real
    // rpc.Server on first call.
    this.rpcClient = rpcClient ?? null
  }

  get chainId(): string {
    return this.config.chainId
  }

  /**
   * Returns the underlying Soroban RPC client. Lazy-instantiates a
   * real `rpc.Server` against `config.rpcUrl` if none was injected.
   */
  private get rpc(): StellarRpcClient {
    if (!this.rpcClient) {
      this.rpcClient = new rpc.Server(this.config.rpcUrl) as StellarRpcClient
    }
    return this.rpcClient
  }

  /**
   * Resolves the asset's Soroban Asset Contract address. Prefers the
   * explicit `config.usdcSac` when set; otherwise derives from
   * `Asset.getContractId(networkPassphrase)` using Circle's well-known
   * issuer.
   */
  private resolveAssetAddress(currency: 'USDC' | 'EURC'): string {
    if (currency === 'USDC' && this.config.usdcSac) return this.config.usdcSac
    const issuer = USDC_ISSUER[this.config.network]
    if (currency !== 'USDC' || !issuer) {
      throw new Error(
        `asset ${currency} is not configured for ${this.config.chainId} — set config.usdcSac`,
      )
    }
    return new Asset('USDC', issuer).contractId(NETWORK_PASSPHRASE[this.config.network])
  }

  // ---------- Addresses ----------

  validateAddress(address: string): boolean {
    return isValidStellarPayoutAddress(address)
  }

  normaliseAddress(address: string): string {
    try {
      return normaliseStellarAddress(address)
    } catch {
      throw new InvalidAddressError(this.chainId, address)
    }
  }

  // ---------- One-shot payments ----------

  async preparePayment(input: PreparePaymentInput): Promise<PreparePaymentResult> {
    if (!this.config.contracts.payments) {
      throw new Error(
        `${this.chainId}: StrimzPayments contract not configured — populate SupportedChain.rpcConfig.contracts.payments first`,
      )
    }
    const account = await this.rpc.getAccount(input.payerAddress)
    const { tx, refIdHex } = buildPaymentInvocation(
      {
        paymentsContract: this.config.contracts.payments,
        payerAddress: input.payerAddress,
        merchantAddress: input.merchantAddress,
        assetAddress: this.resolveAssetAddress(input.currency),
        amount: input.amount,
        feeBps: input.feeBps,
        ref: input.ref,
        network: this.config.network,
      },
      account,
    )
    const assembled = await assembleViaSimulation(tx, this.rpc)
    const expiresAt = new Date(Date.now() + 30_000).toISOString()
    return {
      chainId: this.chainId,
      envelope: {
        family: 'stellar',
        data: {
          transactionXdr: assembled.toEnvelope().toXDR('base64'),
          networkPassphrase: NETWORK_PASSPHRASE[this.config.network],
          contractId: this.config.contracts.payments,
          functionName: 'pay' as const,
          args: {
            payer: input.payerAddress,
            merchant: input.merchantAddress,
            asset: this.resolveAssetAddress(input.currency),
            amount: input.amount,
            feeBps: input.feeBps,
            refId: refIdHex,
          },
          expiresAt,
        },
      },
      expiresAt,
    }
  }

  submitPayment(_bundle: SignedPaymentBundle): Promise<RelaySubmission> {
    throw new AdapterNotImplementedError(this.chainId, 'submitPayment')
  }

  // ---------- Subscriptions ----------

  async prepareSubscriptionEnrolment(
    input: PrepareEnrolmentInput,
  ): Promise<PrepareEnrolmentResult> {
    if (!this.config.contracts.subscription) {
      throw new Error(
        `${this.chainId}: StrimzSubscription contract not configured — populate SupportedChain.rpcConfig.contracts.subscription first`,
      )
    }
    const account = await this.rpc.getAccount(input.payerAddress)
    const { tx } = buildEnrolmentInvocation(
      {
        subscriptionContract: this.config.contracts.subscription,
        payerAddress: input.payerAddress,
        merchantAddress: input.merchantAddress,
        assetAddress: this.resolveAssetAddress(input.currency),
        amountPerPeriod: input.amount,
        periodSeconds: input.intervalSeconds,
        feeBps: input.feeBps,
        endAt: input.endAt,
        network: this.config.network,
      },
      account,
    )
    const assembled = await assembleViaSimulation(tx, this.rpc)
    const expiresAt = new Date(Date.now() + 30_000).toISOString()
    return {
      chainId: this.chainId,
      envelope: {
        family: 'stellar',
        data: {
          transactionXdr: assembled.toEnvelope().toXDR('base64'),
          networkPassphrase: NETWORK_PASSPHRASE[this.config.network],
          contractId: this.config.contracts.subscription,
          functionName: 'enrol' as const,
          args: {
            payer: input.payerAddress,
            merchant: input.merchantAddress,
            asset: this.resolveAssetAddress(input.currency),
            amountPerPeriod: input.amount,
            periodSeconds: input.intervalSeconds,
            feeBps: input.feeBps,
            endAt: input.endAt,
          },
          expiresAt,
        },
      },
      expiresAt,
    }
  }

  submitSubscriptionEnrolment(_bundle: SignedEnrolmentBundle): Promise<RelaySubmission> {
    throw new AdapterNotImplementedError(this.chainId, 'submitSubscriptionEnrolment')
  }

  chargeSubscription(_input: ChargeSubscriptionInput): Promise<RelaySubmission> {
    throw new AdapterNotImplementedError(this.chainId, 'chargeSubscription')
  }

  // ---------- Refunds ----------

  refund(_input: RefundInput): Promise<RelaySubmission> {
    throw new AdapterNotImplementedError(this.chainId, 'refund')
  }

  // ---------- Indexer ----------

  subscribeEvents(_handlers: ChainEventHandlers): Promise<Unsubscribe> {
    throw new AdapterNotImplementedError(this.chainId, 'subscribeEvents')
  }

  // ---------- Stellar-specific ----------

  refreshAllowance(_input: RefreshAllowanceInput): Promise<RelaySubmission> {
    throw new AdapterNotImplementedError(this.chainId, 'refreshAllowance')
  }
}
