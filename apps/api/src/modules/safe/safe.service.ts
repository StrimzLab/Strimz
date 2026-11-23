import { randomBytes } from 'node:crypto'

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { Prisma, type SafeProposal, type SafeProposalSignature } from '@strimz/db'
import { getTokenAddress } from '@strimz/shared-config'
import { PrivyPolicyViolationError, toSignerAccount, type TransactionSigner } from '@strimz/signer'
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  isAddressEqual,
  keccak256,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { KMS_SIGNER } from '../../infra/kms/kms.tokens.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { GasPricingService } from '../relay/gas-pricing.service.js'
import { NonceManager } from '../relay/nonce-manager.service.js'
import { safeAbis } from './safe-abi.js'
import {
  buildSafeCall,
  timelockExecuteCall,
  type BuiltSafeCall,
  type RoleTarget,
  type SafeAction,
  type SafeContext,
} from './safe-actions.js'
import {
  normalizeSafeSignature,
  packSignatures,
  recoverSafeSigner,
  safeTxHash,
  type SafeTx,
} from './safe-tx.js'

type ProposalRow = SafeProposal & { signatures: SafeProposalSignature[] }

interface SafeConfig {
  chainId: number
  safe: Address
  timelock: Address
  guardian: Address
  contracts: Record<RoleTarget, Address>
  tokens: { USDC: Address; EURC: Address }
}

const OPEN = ['collecting', 'ready'] as const

@Injectable()
export class SafeService {
  private readonly log = new Logger(SafeService.name)

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
    private readonly nonces: NonceManager,
    private readonly gas: GasPricingService,
    @Inject(KMS_SIGNER) private readonly signer: TransactionSigner,
  ) {}

  async state() {
    const c = this.config()
    const ctx = await this.context(c)
    const [nonce, paymentsPaused, subscriptionsPaused] = await Promise.all([
      this.safeNonce(c),
      this.paused(c.contracts.payments),
      this.paused(c.contracts.subscriptions),
    ])
    return {
      chainId: c.chainId,
      safe: c.safe,
      timelock: c.timelock,
      guardian: c.guardian,
      contracts: c.contracts,
      owners: ctx.owners,
      threshold: ctx.threshold,
      nonce: Number(nonce),
      timelockDelaySeconds: Number(ctx.timelockDelay),
      paused: { payments: paymentsPaused, subscriptions: subscriptionsPaused },
    }
  }

  async list() {
    const c = this.config()
    await this.settle(c)
    const rows = await this.prisma.db.safeProposal.findMany({
      where: { safeAddress: c.safe },
      include: { signatures: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return { data: rows.map((r) => this.view(r)) }
  }

  async propose(action: SafeAction, adminId: string) {
    const c = this.config()
    const ctx = await this.context(c)
    const salt = toHex(randomBytes(32))
    let built: BuiltSafeCall
    try {
      built = buildSafeCall(action, ctx, salt)
    } catch (err) {
      throw new BadRequestException({
        code: 'invalid_safe_action',
        message: (err as Error).message,
      })
    }
    return this.create(c, built, action, adminId, null)
  }

  async proposeTimelockExecute(scheduleId: string, adminId: string) {
    const c = this.config()
    const scheduled = await this.prisma.db.safeProposal.findFirst({
      where: { id: scheduleId, safeAddress: c.safe },
    })
    if (!scheduled?.timelockOperationId || !scheduled.timelockTarget || !scheduled.timelockData) {
      throw new NotFoundException({ code: 'not_found', message: 'no scheduled Timelock operation' })
    }
    if (scheduled.status !== 'executed') {
      throw new ConflictException({
        code: 'not_scheduled',
        message: 'the schedule proposal has not been executed yet',
      })
    }
    const readyAt = await this.chain.client.readContract({
      address: c.timelock,
      abi: safeAbis.timelock,
      functionName: 'getTimestamp',
      args: [scheduled.timelockOperationId as Hex],
    })
    // 0 is unknown or cancelled, 1 is already done.
    if (readyAt <= 1n) {
      throw new ConflictException({
        code: 'timelock_not_pending',
        message: 'the Timelock operation was cancelled or has already run',
      })
    }
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (readyAt > now) {
      throw new ConflictException({
        code: 'timelock_not_ready',
        message: `the Timelock operation is ready at ${new Date(Number(readyAt) * 1000).toISOString()}`,
      })
    }
    const ctx = await this.context(c)
    const built = timelockExecuteCall(ctx, {
      target: getAddress(scheduled.timelockTarget),
      data: scheduled.timelockData as Hex,
      salt: scheduled.timelockSalt as Hex,
      operationId: scheduled.timelockOperationId as Hex,
    })
    return this.create(
      c,
      built,
      { kind: 'timelockExecute', operationId: scheduled.timelockOperationId },
      adminId,
      scheduled.id,
    )
  }

  async sign(id: string, rawSignature: string, adminId: string) {
    const c = this.config()
    const proposal = await this.find(c, id)
    if (!OPEN.includes(proposal.status as (typeof OPEN)[number])) {
      throw new ConflictException({
        code: 'invalid_state',
        message: `proposal is ${proposal.status}`,
      })
    }
    const nonce = await this.safeNonce(c)
    if (BigInt(proposal.nonce) !== nonce) {
      await this.markStale(proposal.id)
      throw new ConflictException({
        code: 'stale_proposal',
        message: 'the Safe has moved past this proposal; propose it again',
      })
    }
    let signature: Hex
    let signer: Address
    try {
      signature = normalizeSafeSignature(rawSignature as Hex)
      signer = await recoverSafeSigner(c.chainId, c.safe, this.txOf(proposal), signature)
    } catch (err) {
      throw new BadRequestException({ code: 'invalid_signature', message: (err as Error).message })
    }
    const { owners, threshold } = await this.context(c)
    if (!owners.some((o) => isAddressEqual(o, signer))) {
      throw new BadRequestException({
        code: 'not_an_owner',
        message: `${signer} signed this, but it is not a Safe owner`,
      })
    }
    try {
      await this.prisma.db.safeProposalSignature.create({
        data: { proposalId: proposal.id, signer, signature, adminUserId: adminId },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'already_signed', message: `${signer} already signed` })
      }
      throw err
    }
    const valid = await this.ownerSignatures(proposal.id, owners)
    if (valid.length >= threshold) {
      await this.prisma.db.safeProposal.updateMany({
        where: { id: proposal.id, status: 'collecting' },
        data: { status: 'ready' },
      })
    }
    await this.audit(adminId, 'safe.signed', proposal.id, {
      signer,
      safeTxHash: proposal.safeTxHash,
    })
    return this.view(await this.find(c, id))
  }

  async execute(id: string, adminId: string) {
    const c = this.config()
    const proposal = await this.find(c, id)
    if (proposal.status !== 'ready') {
      throw new ConflictException({
        code: 'invalid_state',
        message: `proposal is ${proposal.status}`,
      })
    }
    const nonce = await this.safeNonce(c)
    if (BigInt(proposal.nonce) !== nonce) {
      await this.markStale(proposal.id)
      throw new ConflictException({
        code: 'stale_proposal',
        message: 'the Safe has moved past this proposal; propose it again',
      })
    }
    const { owners, threshold } = await this.context(c)
    const sigs = await this.ownerSignatures(proposal.id, owners)
    if (sigs.length < threshold) {
      await this.prisma.db.safeProposal.update({
        where: { id: proposal.id },
        data: { status: 'collecting' },
      })
      throw new ConflictException({
        code: 'not_enough_signatures',
        message: `${sigs.length} of ${threshold} current owners have signed`,
      })
    }
    const claimed = await this.prisma.db.safeProposal.updateMany({
      where: { id: proposal.id, status: 'ready' },
      data: { status: 'executing', executedById: adminId },
    })
    if (claimed.count === 0) {
      throw new ConflictException({ code: 'invalid_state', message: 'already being executed' })
    }

    const tx = this.txOf(proposal)
    const data = encodeFunctionData({
      abi: safeAbis.safe,
      functionName: 'execTransaction',
      args: [
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        0n,
        0n,
        0n,
        zeroAddress,
        zeroAddress,
        packSignatures(sigs.slice(0, threshold)),
      ],
    })
    const release = () =>
      this.prisma.db.safeProposal.update({
        where: { id: proposal.id },
        data: { status: 'ready', executedById: null, executeTxHash: null },
      })
    let signed: { serialized: Hex; txHash: Hex }
    try {
      signed = await this.signExec(c, data)
    } catch (err) {
      await release()
      if (err instanceof PrivyPolicyViolationError) {
        throw new ServiceUnavailableException({
          code: 'relayer_refused',
          message: 'the relayer is not allowed to send Safe transactions yet (run safe-rule)',
        })
      }
      throw err
    }
    const txHash = signed.txHash
    await this.prisma.db.safeProposal.update({
      where: { id: proposal.id },
      data: { executeTxHash: txHash },
    })
    try {
      await this.chain.client.sendRawTransaction({ serializedTransaction: signed.serialized })
    } catch (err) {
      await this.nonces.resync(c.chainId, this.signer.address)
      const known = await this.chain.client
        .getTransaction({ hash: txHash })
        .then(() => true)
        .catch(() => false)
      if (!known) {
        await release()
        throw err
      }
    }
    await this.audit(adminId, 'safe.executed', proposal.id, {
      safeTxHash: proposal.safeTxHash,
      transactionHash: txHash,
    })
    await this.finish(proposal.id, txHash)
    return this.view(await this.find(c, id))
  }

  private async create(
    c: SafeConfig,
    built: BuiltSafeCall,
    action: SafeAction | { kind: 'timelockExecute'; operationId: string },
    adminId: string,
    scheduledById: string | null,
  ) {
    const nonce = await this.safeNonce(c)
    const tx: SafeTx = { ...built.call, nonce }
    const hash = safeTxHash(c.chainId, c.safe, tx)
    const onchain = await this.chain.client.readContract({
      address: c.safe,
      abi: safeAbis.safe,
      functionName: 'getTransactionHash',
      args: [tx.to, tx.value, tx.data, tx.operation, 0n, 0n, 0n, zeroAddress, zeroAddress, nonce],
    })
    if (onchain !== hash) {
      this.log.error(`Safe hash mismatch: computed ${hash}, Safe says ${onchain}`)
      throw new ServiceUnavailableException({
        code: 'safe_hash_mismatch',
        message: 'the Safe computed a different transaction hash; nothing was saved',
      })
    }
    try {
      const row = await this.prisma.db.safeProposal.create({
        data: {
          chainId: c.chainId,
          safeAddress: c.safe,
          action: action as Prisma.InputJsonValue,
          to: tx.to,
          data: tx.data,
          nonce: Number(nonce),
          safeTxHash: hash,
          timelockTarget: built.timelock?.target ?? null,
          timelockData: built.timelock?.data ?? null,
          timelockSalt: built.timelock?.salt ?? null,
          timelockOperationId: built.timelock?.operationId ?? null,
          scheduledById,
          proposedById: adminId,
        },
        include: { signatures: true },
      })
      await this.audit(adminId, 'safe.proposed', row.id, { action, safeTxHash: hash })
      return this.view(row)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'already_proposed',
          message: 'the same transaction is already proposed at this nonce',
        })
      }
      throw err
    }
  }

  private async signExec(c: SafeConfig, data: Hex): Promise<{ serialized: Hex; txHash: Hex }> {
    const from = this.signer.address
    let gas: bigint
    try {
      gas = await this.chain.client.estimateGas({ account: from, to: c.safe, data })
    } catch (err) {
      throw new ConflictException({
        code: 'would_revert',
        message: `the Safe would reject this transaction: ${(err as Error).message.split('\n')[0]}`,
      })
    }
    const nonce = await this.nonces.acquire(c.chainId, from)
    try {
      const serialized = await toSignerAccount(this.signer).signTransaction({
        type: 'eip1559',
        chainId: c.chainId,
        nonce: Number(nonce),
        to: c.safe,
        data,
        value: 0n,
        gas: (gas * 12n) / 10n,
        ...(await this.gas.compute()),
      })
      return { serialized, txHash: keccak256(serialized) }
    } catch (err) {
      // Nothing was sent, so the nonce is still free.
      await this.nonces.resync(c.chainId, from)
      throw err
    }
  }

  private async finish(id: string, txHash: Hex) {
    const receipt = await this.chain.client
      .waitForTransactionReceipt({ hash: txHash, timeout: 60_000, pollingInterval: 500 })
      .catch((err: unknown) => {
        this.log.warn(`Safe execute ${txHash} not confirmed yet: ${(err as Error).message}`)
        return null
      })
    if (!receipt) return
    await this.prisma.db.safeProposal.update({
      where: { id },
      data:
        receipt.status === 'success'
          ? { status: 'executed', executedAt: new Date() }
          : { status: 'failed', failureReason: `reverted in block ${receipt.blockNumber}` },
    })
  }

  // Executing rows whose receipt arrived after the request, and open rows the Safe moved past.
  private async settle(c: SafeConfig) {
    const executing = await this.prisma.db.safeProposal.findMany({
      where: { safeAddress: c.safe, status: 'executing', executeTxHash: { not: null } },
    })
    for (const row of executing) {
      const receipt = await this.chain.client
        .getTransactionReceipt({ hash: row.executeTxHash as Hex })
        .catch(() => null)
      if (receipt) await this.finish(row.id, row.executeTxHash as Hex)
    }
    const nonce = await this.safeNonce(c)
    await this.prisma.db.safeProposal.updateMany({
      where: { safeAddress: c.safe, status: { in: [...OPEN] }, nonce: { lt: Number(nonce) } },
      data: { status: 'stale' },
    })
  }

  private async ownerSignatures(proposalId: string, owners: Address[]) {
    const rows = await this.prisma.db.safeProposalSignature.findMany({ where: { proposalId } })
    return rows
      .filter((r) => owners.some((o) => isAddressEqual(o, r.signer as Address)))
      .map((r) => ({ signer: getAddress(r.signer), signature: r.signature as Hex }))
  }

  private view(row: ProposalRow) {
    return {
      id: row.id,
      action: row.action,
      to: row.to,
      data: row.data,
      nonce: row.nonce,
      safeTxHash: row.safeTxHash,
      status: row.status,
      timelockOperationId: row.timelockOperationId,
      scheduledById: row.scheduledById,
      proposedById: row.proposedById,
      executedById: row.executedById,
      executeTxHash: row.executeTxHash,
      failureReason: row.failureReason,
      executedAt: row.executedAt,
      createdAt: row.createdAt,
      signatures: row.signatures.map((s) => ({
        signer: s.signer,
        signature: s.signature,
        createdAt: s.createdAt,
      })),
    }
  }

  private txOf(row: SafeProposal): SafeTx {
    return {
      to: getAddress(row.to),
      value: 0n,
      data: row.data as Hex,
      operation: 0,
      nonce: BigInt(row.nonce),
    }
  }

  private async find(c: SafeConfig, id: string): Promise<ProposalRow> {
    const row = await this.prisma.db.safeProposal.findFirst({
      where: { id, safeAddress: c.safe },
      include: { signatures: { orderBy: { createdAt: 'asc' } } },
    })
    if (!row) throw new NotFoundException({ code: 'not_found' })
    return row
  }

  private markStale(id: string) {
    return this.prisma.db.safeProposal.update({ where: { id }, data: { status: 'stale' } })
  }

  private safeNonce(c: SafeConfig) {
    return this.chain.client.readContract({
      address: c.safe,
      abi: safeAbis.safe,
      functionName: 'nonce',
    })
  }

  private paused(address: Address) {
    return this.chain.client.readContract({
      address,
      abi: safeAbis.pausable,
      functionName: 'paused',
    })
  }

  private async context(c: SafeConfig): Promise<SafeContext> {
    const [owners, threshold, delay] = await Promise.all([
      this.chain.client.readContract({
        address: c.safe,
        abi: safeAbis.safe,
        functionName: 'getOwners',
      }),
      this.chain.client.readContract({
        address: c.safe,
        abi: safeAbis.safe,
        functionName: 'getThreshold',
      }),
      this.chain.client.readContract({
        address: c.timelock,
        abi: safeAbis.timelock,
        functionName: 'getMinDelay',
      }),
    ])
    return {
      safe: c.safe,
      timelock: c.timelock,
      contracts: c.contracts,
      tokens: c.tokens,
      owners: owners.map((o) => getAddress(o)),
      threshold: Number(threshold),
      timelockDelay: delay,
    }
  }

  private audit(actorId: string, action: string, targetId: string, metadata: object) {
    return this.prisma.db.auditLog.create({
      data: {
        actorId,
        category: 'admin',
        action,
        targetType: 'SafeProposal',
        targetId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    })
  }

  private config(): SafeConfig {
    const env = this.cfg.env
    const need = (name: keyof typeof env): Address => {
      const value = env[name]
      if (typeof value !== 'string' || !isAddress(value, { strict: false })) {
        throw new ServiceUnavailableException({
          code: 'safe_console_not_configured',
          message: `${String(name)} is not set`,
        })
      }
      return getAddress(value)
    }
    const chainId = this.chain.client.chain?.id
    if (!chainId) throw new Error('safe console: chain client has no chain bound')
    return {
      chainId,
      safe: need('STRIMZ_SAFE_ADDRESS'),
      timelock: need('TIMELOCK_ADDRESS'),
      guardian: need('STRIMZ_GUARDIAN_ADDRESS'),
      contracts: {
        registry: need('STRIMZ_REGISTRY_ADDRESS'),
        payments: need('STRIMZ_PAYMENTS_ADDRESS'),
        subscriptions: need('STRIMZ_SUBSCRIPTIONS_ADDRESS'),
        feeCollector: need('STRIMZ_FEE_COLLECTOR_ADDRESS'),
        tokenWhitelist: need('STRIMZ_TOKEN_WHITELIST_ADDRESS'),
      },
      tokens: {
        USDC: getTokenAddress(this.chain.environment, 'USDC'),
        EURC: getTokenAddress(this.chain.environment, 'EURC'),
      },
    }
  }
}
