import { Injectable, Logger } from '@nestjs/common'
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import { arcMainnet, arcTestnet, getCctpContracts } from '@strimz/shared-config'
import { TypedConfigService } from '../../config/index.js'
import { StrimzSubscriptionsAbi, StrimzAgentEscrowAbi, MessageTransmitterAbi } from './abis.js'

/**
 * Chain access for the scheduler.
 *
 * Holds two clients:
 *   - `public`  — RPC reads (gas estimation, receipt polling)
 *   - `wallet`  — service-wallet writes; signing happens locally with the
 *                env-loaded private key. The key never leaves this process.
 *
 * Every write helper:
 *   1. estimates gas (so we surface chain-level reverts before broadcast)
 *   2. broadcasts the tx
 *   3. returns the tx hash; the indexer projects the resulting event
 *
 * Receipt waiting is intentionally NOT done here — workers return after
 * broadcast and let the indexer flip DB state when the event lands.
 * Holding workers open during 12-block confirmations would needlessly
 * pin queue concurrency.
 */
@Injectable()
export class ChainService {
  public readonly publicClient: PublicClient
  public readonly walletClient: WalletClient
  // PrivateKeyAccount (not just `{ address }`): viem dispatches to
  // local signing + eth_sendRawTransaction only when it sees a
  // LocalAccount object. A bare address string sends viem down the
  // wallet_sendTransaction path, which RPC nodes don't implement.
  public readonly account: PrivateKeyAccount
  public readonly subscriptionsAddress: Address
  public readonly agentEscrowAddress: Address
  public readonly messageTransmitterAddress: Address
  private readonly log = new Logger(ChainService.name)

  constructor(cfg: TypedConfigService) {
    const chain = cfg.env.ARC_ENVIRONMENT === 'mainnet' ? arcMainnet : arcTestnet
    const transport = http(cfg.env.ARC_RPC_URL)

    this.publicClient = createPublicClient({ chain, transport }) as PublicClient
    const account = privateKeyToAccount(cfg.env.SCHEDULER_PRIVATE_KEY as `0x${string}`)
    this.account = account
    this.walletClient = createWalletClient({ account, chain, transport })

    this.subscriptionsAddress = cfg.env.SUBSCRIPTIONS_ADDRESS as Address
    this.agentEscrowAddress = cfg.env.AGENT_ESCROW_ADDRESS as Address
    this.messageTransmitterAddress = getCctpContracts(cfg.env.ARC_ENVIRONMENT)
      .messageTransmitterV2 as Address
    this.log.log(`scheduler signing as ${account.address}`)
  }

  // ----- Subscription writes -----

  /** Cancels a single on-chain subscription. */
  async cancelSubscription(subscriptionId: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.subscriptionsAddress,
      abi: StrimzSubscriptionsAbi,
      functionName: 'cancel',
      args: [subscriptionId],
      chain: null,
    })
  }

  /**
   * Batches up to N due subscriptions in a single tx for gas efficiency.
   *
   * The contract's `batchCharge(uint256[], bytes32[])` writes per-attempt
   * outcomes so a single failure (e.g. one subscriber's allowance lapsed)
   * doesn't roll back the rest. The indexer projects the resulting
   * `SubscriptionCharged` / `SubscriptionChargeSkipped` events.
   */
  async batchCharge(
    subscriptionIds: readonly bigint[],
    chargeAttemptIds: readonly `0x${string}`[],
  ): Promise<Hash> {
    if (subscriptionIds.length !== chargeAttemptIds.length) {
      throw new Error('batchCharge: subscriptionIds.length !== chargeAttemptIds.length')
    }
    return this.walletClient.writeContract({
      account: this.account,
      address: this.subscriptionsAddress,
      abi: StrimzSubscriptionsAbi,
      functionName: 'batchCharge',
      args: [subscriptionIds, chargeAttemptIds],
      chain: null,
    })
  }

  /** True if the on-chain idempotency check has already burned the attempt id. */
  async isAttemptUsed(chargeAttemptId: `0x${string}`): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.subscriptionsAddress,
      abi: StrimzSubscriptionsAbi,
      functionName: 'isAttemptUsed',
      args: [chargeAttemptId],
    })
  }

  /** True if the on-chain subscription is currently due for a charge. */
  async isChargeDue(subscriptionId: bigint): Promise<boolean> {
    const sub = await this.publicClient.readContract({
      address: this.subscriptionsAddress,
      abi: StrimzSubscriptionsAbi,
      functionName: 'getSubscription',
      args: [subscriptionId],
    })
    if (sub.cancelled) return false
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (sub.endAt !== 0n && now >= sub.endAt) return false
    return now >= sub.nextChargeAt
  }

  // ----- Agent escrow writes -----

  async createJob(input: {
    vendor: Address
    assessor: Address
    token: Address
    amount: bigint
    description: string
  }): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.agentEscrowAddress,
      abi: StrimzAgentEscrowAbi,
      functionName: 'createJob',
      args: [input.vendor, input.assessor, input.token, input.amount, input.description],
      chain: null,
    })
  }

  async approveAndReleaseJob(jobId: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.agentEscrowAddress,
      abi: StrimzAgentEscrowAbi,
      functionName: 'approveAndRelease',
      args: [jobId],
      chain: null,
    })
  }

  async disputeJob(jobId: bigint, reason: string): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.agentEscrowAddress,
      abi: StrimzAgentEscrowAbi,
      functionName: 'dispute',
      args: [jobId, reason],
      chain: null,
    })
  }

  async cancelJob(jobId: bigint, reason: string): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.agentEscrowAddress,
      abi: StrimzAgentEscrowAbi,
      functionName: 'cancelJob',
      args: [jobId, reason],
      chain: null,
    })
  }

  // ----- CCTP V2 settlement -----

  /**
   * Calls `MessageTransmitter.receiveMessage(message, attestation)` on
   * Arc — the destination-chain settlement of a cross-chain USDC bridge
   * initiated by a payer on a different chain. The Circle attestation
   * service signed the message; this is the on-chain claim.
   *
   * Idempotent at the contract level: re-calling with the same message
   * reverts with `MessageAlreadyUsed`. The agent's bridge worker won't
   * normally re-enqueue, but the property still holds.
   */
  async receiveCctpMessage(input: {
    messageHex: `0x${string}`
    attestationHex: `0x${string}`
  }): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.messageTransmitterAddress,
      abi: MessageTransmitterAbi,
      functionName: 'receiveMessage',
      args: [input.messageHex, input.attestationHex],
      chain: null,
    })
  }
}
