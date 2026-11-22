import { describe, expect, it, vi } from 'vitest'
import {
  keccak256,
  parseTransaction,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError,
  type Hex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { RelayJob } from '@strimz/queue-contracts'
import { relayJobFixtures } from '@strimz/queue-contracts/fixtures'
import {
  PrivyPolicyViolationError,
  PrivyServerSigner,
  type PrivyTransaction,
  type PrivyWalletApi,
} from '@strimz/signer'

import {
  RelayJobRunner,
  RelayPermanentError,
  type RelayJobHandle,
} from '../../../../src/modules/relay/relay-job-runner.js'
import type { ChainService } from '../../../../src/infra/chain/chain.service.js'
import type { PrismaService } from '../../../../src/infra/prisma/prisma.service.js'
import type { TypedConfigService } from '../../../../src/config/index.js'
import type { GasPricingService } from '../../../../src/modules/relay/gas-pricing.service.js'
import type { NonceManager } from '../../../../src/modules/relay/nonce-manager.service.js'
import type { RelayBudgetService } from '../../../../src/modules/relay/relay-budget.service.js'
import { openRelayGuard } from '../../../helpers/stubs/relay-guard.stub.js'
import type { RelayGuardService } from '../../../../src/modules/relay/relay-guard.service.js'

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://strimz:strimz@localhost:5432/strimz',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    PRIVY_APP_ID: process.env.PRIVY_APP_ID ?? 'test-privy-app',
    PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET ?? 'test-privy-secret',
    STRIMZ_WEBHOOK_SIGNING_SECRET:
      process.env.STRIMZ_WEBHOOK_SIGNING_SECRET ?? 'test-webhook-secret-at-least-32-chars-long',
    WEBHOOK_SECRET_ENCRYPTION_KEY: process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ?? 'ab'.repeat(32),
    ARC_RPC_URL: process.env.ARC_RPC_URL ?? 'http://localhost:8545',
  })
})

class FakeChain {
  readonly sent: Array<{ hash: Hex; nonce: number }> = []
  readonly mined = new Set<Hex>()
  mineOnSend = true

  readonly client = {
    chain: { id: 5042002 },
    sendRawTransaction: ({ serializedTransaction }: { serializedTransaction: Hex }) => {
      const hash = keccak256(serializedTransaction)
      this.sent.push({ hash, nonce: Number(parseTransaction(serializedTransaction).nonce) })
      if (this.mineOnSend) this.mined.add(hash)
      return Promise.resolve(hash)
    },
    waitForTransactionReceipt: ({ hash }: { hash: Hex }) =>
      this.mined.has(hash)
        ? Promise.resolve(this.receipt(hash))
        : Promise.reject(new WaitForTransactionReceiptTimeoutError({ hash })),
    getTransactionReceipt: ({ hash }: { hash: Hex }) =>
      this.mined.has(hash)
        ? Promise.resolve(this.receipt(hash))
        : Promise.reject(new TransactionReceiptNotFoundError({ hash })),
    getTransaction: ({ hash }: { hash: Hex }) =>
      Promise.reject(new TransactionNotFoundError({ hash })),
    getTransactionCount: () => Promise.resolve(0),
  }

  receipt(hash: Hex) {
    return {
      status: 'success' as const,
      transactionHash: hash,
      blockNumber: 7n,
      blockHash: `0x${'b'.repeat(64)}` as Hex,
      gasUsed: 1n,
      effectiveGasPrice: 1n,
      logs: [],
    }
  }
}

function handle(data: RelayJob, attemptsMade = 0): RelayJobHandle & { data: RelayJob } {
  const h = {
    id: data.idempotencyKey,
    attemptsMade,
    data,
    updateData(next: RelayJob) {
      h.data = next
      return Promise.resolve()
    },
  }
  return h
}

const payment = (): RelayJob => {
  const { merchantInternalId: _m, sessionId: _s, ...job } = relayJobFixtures.payWithAuthorization
  return job
}

const enclave = privateKeyToAccount(generatePrivateKey())

function privyApi(sign: (tx: PrivyTransaction) => Promise<Hex>): PrivyWalletApi {
  return {
    walletAddress: () => Promise.resolve(enclave.address),
    signTransaction: vi.fn((_walletId: string, tx: PrivyTransaction) => sign(tx)),
  }
}

const signLocally = (tx: PrivyTransaction) =>
  enclave.signTransaction({
    type: 'eip1559',
    chainId: tx.chain_id,
    to: tx.to as Hex,
    data: tx.data as Hex,
    value: BigInt(tx.value),
    nonce: tx.nonce,
    gas: BigInt(tx.gas_limit),
    maxFeePerGas: BigInt(tx.max_fee_per_gas),
    maxPriorityFeePerGas: BigInt(tx.max_priority_fee_per_gas),
  })

async function setup(api: PrivyWalletApi) {
  const chain = new FakeChain()
  const signer = await PrivyServerSigner.connect({
    api,
    walletId: 'relayer-wallet',
    expectedAddress: enclave.address,
  })
  const nonces = {
    acquire: vi.fn(() => Promise.resolve(0n)),
    resync: vi.fn(() => Promise.resolve()),
  }
  const guard = Object.assign(openRelayGuard(), {
    alertSigningRefused: vi.fn(() => Promise.resolve()),
  }) as unknown as RelayGuardService & { alertSigningRefused: ReturnType<typeof vi.fn> }
  const runner = new RelayJobRunner(
    chain as unknown as ChainService,
    nonces as unknown as NonceManager,
    {
      compute: () => Promise.resolve({ maxFeePerGas: 30n, maxPriorityFeePerGas: 1n }),
    } as unknown as GasPricingService,
    {} as PrismaService,
    signer,
    {
      env: { STRIMZ_REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000a01' },
    } as unknown as TypedConfigService,
    {
      recordGas: () => Promise.resolve(),
      release: () => Promise.resolve(),
    } as unknown as RelayBudgetService,
    guard,
  )
  return { chain, nonces, guard, runner }
}

// ADR-2026-11-22-privy-server-signers.
describe('relaying with a Privy wallet', () => {
  it('broadcasts the transaction Privy signed, from the Privy wallet', async () => {
    const { chain, runner } = await setup(privyApi(signLocally))
    const job = handle(payment())
    await runner.run(job)
    expect(chain.sent).toHaveLength(1)
    expect(job.data.broadcast?.from).toBe(enclave.address)
  })

  it('stops for good, frees the nonce and alerts ops when the Privy policy refuses', async () => {
    const { chain, nonces, guard, runner } = await setup(
      privyApi(() => Promise.reject(new PrivyPolicyViolationError('relayer-wallet'))),
    )
    const err = await runner.run(handle(payment())).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RelayPermanentError)
    expect(chain.sent).toHaveLength(0)
    expect(nonces.resync).toHaveBeenCalledTimes(1)
    expect(guard.alertSigningRefused).toHaveBeenCalledTimes(1)
  })

  it('frees the nonce and lets the job retry when Privy is briefly unreachable', async () => {
    const outage = new Error('503 Service Unavailable')
    const { chain, nonces, guard, runner } = await setup(privyApi(() => Promise.reject(outage)))
    const err = await runner.run(handle(payment())).catch((e: unknown) => e)
    expect(err).toBe(outage)
    expect(chain.sent).toHaveLength(0)
    expect(nonces.resync).toHaveBeenCalledTimes(1)
    expect(guard.alertSigningRefused).not.toHaveBeenCalled()
  })
})
