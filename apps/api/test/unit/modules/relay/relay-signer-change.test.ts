import { describe, expect, it, vi } from 'vitest'
import {
  keccak256,
  parseTransaction,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError,
  type Hex,
} from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import type { RelayJob } from '@strimz/queue-contracts'
import { relayJobFixtures } from '@strimz/queue-contracts/fixtures'
import { SoftwareSigner } from '@strimz/signer'

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

const OLD_SIGNER = '0x00000000000000000000000000000000000001d0'
const STALE_TX = `0x${'5'.repeat(64)}` as Hex

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

function setup() {
  const chain = new FakeChain()
  const signer = new SoftwareSigner(generatePrivateKey())
  let next = 0n
  const runner = new RelayJobRunner(
    chain as unknown as ChainService,
    {
      acquire: () => Promise.resolve(next++),
      resync: () => Promise.resolve(),
    } as unknown as NonceManager,
    {
      compute: () => Promise.resolve({ maxFeePerGas: 30n, maxPriorityFeePerGas: 1n }),
    } as unknown as GasPricingService,
    {} as PrismaService,
    signer,
    {
      env: { STRIMZ_REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000a01' },
    } as unknown as TypedConfigService,
    { recordGas: () => Promise.resolve() } as unknown as RelayBudgetService,
  )
  return { chain, signer, runner }
}

const payment = (): RelayJob => {
  const { merchantInternalId: _m, sessionId: _s, ...job } = relayJobFixtures.payWithAuthorization
  return job
}

describe('relay retries across a relayer key change', () => {
  it('records which address broadcast the transaction', async () => {
    const { chain, signer, runner } = setup()
    const job = handle(payment())
    await runner.run(job)
    expect(job.data.broadcast).toEqual({
      txHash: chain.sent[0]?.hash,
      nonce: '0',
      from: signer.address,
      maxFeePerGas: '30',
      maxPriorityFeePerGas: '1',
    })
  })

  it('stops for review when an unsettled broadcast came from another address', async () => {
    const { chain, runner } = setup()
    const job = handle(
      { ...payment(), broadcast: { txHash: STALE_TX, nonce: '57', from: OLD_SIGNER } },
      1,
    )
    const err = await runner.run(job).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RelayPermanentError)
    expect(String(err)).toMatch(/relay_signer_changed/u)
    expect(chain.sent).toHaveLength(0)
  })

  it('stops for review when an unsettled broadcast does not say who sent it', async () => {
    const { chain, runner } = setup()
    const job = handle({ ...payment(), broadcast: { txHash: STALE_TX, nonce: '57' } }, 1)
    await expect(runner.run(job)).rejects.toThrow(/relay_signer_changed/u)
    expect(chain.sent).toHaveLength(0)
  })

  it('returns the receipt of a settled broadcast from another address', async () => {
    const { chain, runner } = setup()
    chain.mined.add(STALE_TX)
    const result = await runner.run(
      handle({ ...payment(), broadcast: { txHash: STALE_TX, nonce: '57', from: OLD_SIGNER } }, 1),
    )
    expect(result).toMatchObject({ txHash: STALE_TX })
    expect(chain.sent).toHaveLength(0)
  })

  it('re-signs with the recorded nonce when the current signer made the broadcast', async () => {
    const { chain, signer, runner } = setup()
    chain.mineOnSend = false
    const job = handle(payment())
    await expect(runner.run(job)).rejects.toBeInstanceOf(WaitForTransactionReceiptTimeoutError)
    chain.mined.clear()
    chain.mineOnSend = true

    await runner.run(handle(job.data, 1))
    expect(chain.sent.map((s) => s.nonce)).toEqual([0, 0])
    expect(job.data.broadcast?.from).toBe(signer.address)
  })
})
