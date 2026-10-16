import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import {
  createNonceManager,
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  type Hash,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { assertArcChainId, getArcChain, getCctpContracts } from '@strimz/shared-config'
import { jsonRpc } from 'viem/nonce'
import { toKmsAccount, type KmsSigner } from '@strimz/signer'
import { TypedConfigService } from '../../config/index.js'
import {
  MessageTransmitterAbi,
  StrimzAgentEscrowAbi,
  StrimzRegistryAbi,
  StrimzSubscriptionsAbi,
} from './abis.js'
import { SCHEDULER_SIGNER } from './scheduler-signer.js'

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
export class ChainService implements OnModuleInit {
  public readonly publicClient: PublicClient
  public readonly walletClient: WalletClient
  // PrivateKeyAccount (not just `{ address }`): viem dispatches to
  // local signing + eth_sendRawTransaction only when it sees a
  // LocalAccount object. A bare address string sends viem down the
  // wallet_sendTransaction path, which RPC nodes don't implement.
  public readonly account: LocalAccount
  public readonly subscriptionsAddress: Address
  public readonly agentEscrowAddress: Address
  public readonly registryAddress: Address
  public readonly messageTransmitterAddress: Address
  private readonly environment: 'testnet' | 'mainnet'
  private readonly chain: Chain
  private readonly production: boolean
  private readonly log = new Logger(ChainService.name)

  constructor(cfg: TypedConfigService, @Inject(SCHEDULER_SIGNER) signer: KmsSigner) {
    this.environment = cfg.env.ARC_ENVIRONMENT
    this.production = cfg.env.NODE_ENV === 'production'
    const chain = getArcChain(this.environment)
    this.chain = chain
    const transport = http(cfg.env.ARC_RPC_URL)

    this.publicClient = createPublicClient({ chain, transport }) as PublicClient
    this.account = {
      ...toKmsAccount(signer),
      nonceManager: createNonceManager({ source: jsonRpc() }),
    }
    this.walletClient = createWalletClient({ account: this.account, chain, transport })

    this.subscriptionsAddress = cfg.env.SUBSCRIPTIONS_ADDRESS as Address
    this.agentEscrowAddress = cfg.env.AGENT_ESCROW_ADDRESS as Address
    this.registryAddress = cfg.env.REGISTRY_ADDRESS as Address
    this.messageTransmitterAddress = getCctpContracts(cfg.env.ARC_ENVIRONMENT)
      .messageTransmitterV2 as Address
    this.log.log(`scheduler signing as ${this.account.address}`)
  }

  async onModuleInit(): Promise<void> {
    if (!this.production) return
    const rpcChainId = await this.publicClient.getChainId()
    assertArcChainId(this.environment, rpcChainId)
    this.log.log(`ARC_RPC_URL serves chain id ${rpcChainId} (${this.environment})`)
  }

  // ----- Subscription writes -----

  /** Cancels a single on-chain subscription. */
  cancelSubscription(subscriptionId: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.subscriptionsAddress,
      abi: StrimzSubscriptionsAbi,
      functionName: 'cancel',
      args: [subscriptionId],
      chain: this.chain,
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
    const txHash = await this.walletClient.writeContract({
      account: this.account,
      address: this.subscriptionsAddress,
      abi: StrimzSubscriptionsAbi,
      functionName: 'batchCharge',
      args: [subscriptionIds, chargeAttemptIds],
      chain: this.chain,
    })
    return txHash
  }

  /** True if the on-chain idempotency check has already burned the attempt id. */
  isAttemptUsed(chargeAttemptId: `0x${string}`): Promise<boolean> {
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

  // ----- Registry -----

  async setMerchantFeeBps(onchainMerchantId: bigint, feeBps: number): Promise<Hash> {
    const hash = await this.walletClient.writeContract({
      account: this.account,
      address: this.registryAddress,
      abi: StrimzRegistryAbi,
      functionName: 'setFeeBps',
      args: [onchainMerchantId, feeBps],
      chain: this.chain,
    })
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`setFeeBps(${onchainMerchantId}, ${feeBps}) reverted in ${hash}`)
    }
    return hash
  }

  async readMerchantFeeBps(onchainMerchantId: bigint): Promise<number> {
    const record = await this.publicClient.readContract({
      address: this.registryAddress,
      abi: StrimzRegistryAbi,
      functionName: 'getMerchant',
      args: [onchainMerchantId],
    })
    return record.feeBps
  }

  // ----- Agent escrow writes -----

  createJob(input: {
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
      chain: this.chain,
    })
  }

  approveAndReleaseJob(jobId: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.agentEscrowAddress,
      abi: StrimzAgentEscrowAbi,
      functionName: 'approveAndRelease',
      args: [jobId],
      chain: this.chain,
    })
  }

  disputeJob(jobId: bigint, reason: string): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.agentEscrowAddress,
      abi: StrimzAgentEscrowAbi,
      functionName: 'dispute',
      args: [jobId, reason],
      chain: this.chain,
    })
  }

  cancelJob(jobId: bigint, reason: string): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.agentEscrowAddress,
      abi: StrimzAgentEscrowAbi,
      functionName: 'cancelJob',
      args: [jobId, reason],
      chain: this.chain,
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
  receiveCctpMessage(input: {
    messageHex: `0x${string}`
    attestationHex: `0x${string}`
  }): Promise<Hash> {
    return this.walletClient.writeContract({
      account: this.account,
      address: this.messageTransmitterAddress,
      abi: MessageTransmitterAbi,
      functionName: 'receiveMessage',
      args: [input.messageHex, input.attestationHex],
      chain: this.chain,
    })
  }
}
