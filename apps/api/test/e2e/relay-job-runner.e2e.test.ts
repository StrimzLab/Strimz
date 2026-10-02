import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { UnrecoverableError } from 'bullmq'
import {
  encodeAbiParameters,
  encodeEventTopics,
  keccak256,
  parseTransaction,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError,
  type Hex,
} from 'viem'
import type { RelayJob } from '@strimz/queue-contracts'
import { relayJobFixtures } from '@strimz/queue-contracts/fixtures'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { must } from '../helpers/must.js'
import { SoftwareKmsProvider } from '../../src/infra/kms/software-kms.provider.js'
import { registerMerchantAbi } from '../../src/modules/merchants/registry.abi.js'
import { RelayJobRunner, type RelayJobHandle } from '../../src/modules/relay/relay-job-runner.js'
import type { ChainService } from '../../src/infra/chain/chain.service.js'
import type { NonceManager } from '../../src/modules/relay/nonce-manager.service.js'
import type { GasPricingService } from '../../src/modules/relay/gas-pricing.service.js'
import type { TypedConfigService } from '../../src/config/index.js'

const REGISTRY = '0x0000000000000000000000000000000000000a01' as const
const WALLET = '0x00000000000000000000000000000000000000c1'
const CHAIN_ID = 5042002

interface FakeReceipt {
  status: 'success' | 'reverted'
  transactionHash: Hex
  blockNumber: bigint
  blockHash: Hex
  logs: Array<{ address: Hex; topics: Hex[]; data: Hex }>
}

class FakeChain {
  readonly sent: Array<{ hash: Hex; nonce: number }> = []
  readonly receipts = new Map<Hex, FakeReceipt>()
  readonly known = new Set<Hex>()
  latestNonce = 0
  mineOnSend = true
  timeoutWaits = 0
  failSends = 0
  revert = false
  nextMerchantId = 41n

  readonly client = {
    chain: { id: CHAIN_ID },
    sendRawTransaction: ({ serializedTransaction }: { serializedTransaction: Hex }) => {
      if (this.failSends > 0) {
        this.failSends -= 1
        return Promise.reject(new Error('rpc unavailable'))
      }
      const hash = keccak256(serializedTransaction)
      const tx = parseTransaction(serializedTransaction)
      this.sent.push({ hash, nonce: must(tx.nonce) })
      this.known.add(hash)
      if (this.mineOnSend) this.mine(hash, must(tx.to) as Hex)
      return Promise.resolve(hash)
    },
    waitForTransactionReceipt: ({ hash }: { hash: Hex }) => {
      const receipt = this.receipts.get(hash)
      if (this.timeoutWaits > 0 || !receipt) {
        if (this.timeoutWaits > 0) this.timeoutWaits -= 1
        return Promise.reject(new WaitForTransactionReceiptTimeoutError({ hash }))
      }
      return Promise.resolve(receipt)
    },
    getTransactionReceipt: ({ hash }: { hash: Hex }) => {
      const receipt = this.receipts.get(hash)
      return receipt
        ? Promise.resolve(receipt)
        : Promise.reject(new TransactionReceiptNotFoundError({ hash }))
    },
    getTransaction: ({ hash }: { hash: Hex }) =>
      this.known.has(hash)
        ? Promise.resolve({ hash })
        : Promise.reject(new TransactionNotFoundError({ hash })),
    getTransactionCount: () => Promise.resolve(this.latestNonce),
  }

  mine(hash: Hex, to: Hex) {
    const logs =
      to.toLowerCase() === REGISTRY
        ? [
            {
              address: REGISTRY as Hex,
              topics: encodeEventTopics({
                abi: registerMerchantAbi,
                eventName: 'MerchantRegistered',
                args: { merchantId: this.nextMerchantId, owner: WALLET as Hex },
              }) as Hex[],
              data: encodeAbiParameters(
                [{ type: 'address' }, { type: 'uint16' }, { type: 'uint16' }, { type: 'uint256' }],
                ['0x000000000000000000000000000000000000beef', 150, 150, 0n],
              ),
            },
          ]
        : []
    this.receipts.set(hash, {
      status: this.revert ? 'reverted' : 'success',
      transactionHash: hash,
      blockNumber: 7n,
      blockHash: `0x${'b'.repeat(64)}`,
      logs,
    })
  }

  forget(hash: Hex) {
    this.known.delete(hash)
    this.receipts.delete(hash)
  }
}

class FakeNonces {
  next = 0n
  acquired: bigint[] = []
  resyncs = 0
  acquire() {
    const n = this.next
    this.next += 1n
    this.acquired.push(n)
    return Promise.resolve(n)
  }
  resync() {
    this.resyncs += 1
    return Promise.resolve()
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

describe('relay job runner', () => {
  let t: TestApp
  let chain: FakeChain
  let nonces: FakeNonces
  let runner: RelayJobRunner

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    chain = new FakeChain()
    nonces = new FakeNonces()
    runner = new RelayJobRunner(
      chain as unknown as ChainService,
      nonces as unknown as NonceManager,
      {
        compute: () => Promise.resolve({ maxFeePerGas: 30n, maxPriorityFeePerGas: 1n }),
      } as unknown as GasPricingService,
      t.prisma,
      new SoftwareKmsProvider(),
      { env: { STRIMZ_REGISTRY_ADDRESS: REGISTRY } } as unknown as TypedConfigService,
    )
  })

  const eligibleMerchant = () =>
    seedMerchant(t.prisma.db, { onboardingCompleted: true, walletAddress: WALLET })

  const registerJob = (merchantId: string): RelayJob => ({
    reason: 'registerMerchant',
    idempotencyKey: `merchant-register:${merchantId}`,
    merchantInternalId: merchantId,
  })

  const onchainId = async (merchantId: string) =>
    (await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: merchantId } })).onchainMerchantId

  it('registers once, records the broadcast and links the decoded id', async () => {
    const m = await eligibleMerchant()
    const job = handle(registerJob(m.id))
    const result = await runner.run(job)

    expect(chain.sent).toHaveLength(1)
    expect(result).toMatchObject({ txHash: must(chain.sent[0]).hash })
    expect(job.data.broadcast).toEqual({ txHash: must(chain.sent[0]).hash, nonce: '0' })
    const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: m.id } })
    expect(row.onchainMerchantId).toBe(41)
    expect(row.onchainRegistrationTxHash).toBe(must(chain.sent[0]).hash)
  })

  it('confirms the recorded transaction on retry after a receipt timeout instead of sending again', async () => {
    const m = await eligibleMerchant()
    chain.timeoutWaits = 1
    const job = handle(registerJob(m.id))
    await expect(runner.run(job)).rejects.toBeInstanceOf(WaitForTransactionReceiptTimeoutError)
    expect(await onchainId(m.id)).toBeNull()

    const retry = handle(job.data, 1)
    await runner.run(retry)
    expect(chain.sent).toHaveLength(1)
    expect(nonces.acquired).toEqual([0n])
    expect(nonces.resyncs).toBe(0)
    expect(await onchainId(m.id)).toBe(41)
  })

  it('re-signs a dropped transaction with the same nonce', async () => {
    const m = await eligibleMerchant()
    chain.mineOnSend = false
    const job = handle(registerJob(m.id))
    await expect(runner.run(job)).rejects.toBeInstanceOf(WaitForTransactionReceiptTimeoutError)
    chain.forget(must(chain.sent[0]).hash)
    chain.latestNonce = 0
    chain.mineOnSend = true

    await runner.run(handle(job.data, 1))
    expect(chain.sent.map((s) => s.nonce)).toEqual([0, 0])
    expect(nonces.acquired).toEqual([0n])
    expect(nonces.resyncs).toBe(0)
    expect(await onchainId(m.id)).toBe(41)
  })

  it('re-signs with the same nonce when the first broadcast never reached the node', async () => {
    const m = await eligibleMerchant()
    chain.failSends = 1
    const job = handle(registerJob(m.id))
    await expect(runner.run(job)).rejects.toThrow('rpc unavailable')
    expect(job.data.broadcast?.nonce).toBe('0')

    await runner.run(handle(job.data, 1))
    expect(chain.sent.map((s) => s.nonce)).toEqual([0])
    expect(nonces.acquired).toEqual([0n])
  })

  it('takes a fresh nonce when the recorded one was used by another transaction', async () => {
    const m = await eligibleMerchant()
    chain.mineOnSend = false
    const job = handle(registerJob(m.id))
    await expect(runner.run(job)).rejects.toBeInstanceOf(WaitForTransactionReceiptTimeoutError)
    chain.forget(must(chain.sent[0]).hash)
    chain.latestNonce = 1
    chain.mineOnSend = true

    await runner.run(handle(job.data, 1))
    expect(nonces.resyncs).toBe(1)
    expect(chain.sent.map((s) => s.nonce)).toEqual([0, 1])
    expect(await onchainId(m.id)).toBe(41)
  })

  it('sends nothing for a merchant that is already linked', async () => {
    const m = await seedMerchant(t.prisma.db, {
      onboardingCompleted: true,
      walletAddress: WALLET,
      onchainMerchantId: 5,
    })
    const result = await runner.run(handle(registerJob(m.id)))
    expect(chain.sent).toHaveLength(0)
    expect(result).toEqual({ skipped: 'already_registered', onchainMerchantId: '5' })
  })

  it('links from an earlier registration transaction when a fresh job arrives', async () => {
    const m = await eligibleMerchant()
    chain.timeoutWaits = 1
    await expect(runner.run(handle(registerJob(m.id)))).rejects.toBeInstanceOf(
      WaitForTransactionReceiptTimeoutError,
    )

    await runner.run(handle(registerJob(m.id)))
    expect(chain.sent).toHaveLength(1)
    expect(await onchainId(m.id)).toBe(41)
  })

  it('fails a reverted registration without retrying and links nothing', async () => {
    const m = await eligibleMerchant()
    chain.revert = true
    await expect(runner.run(handle(registerJob(m.id)))).rejects.toBeInstanceOf(UnrecoverableError)
    expect(await onchainId(m.id)).toBeNull()
  })

  it('never broadcasts a payment twice across a receipt timeout', async () => {
    chain.timeoutWaits = 1
    const job = handle(relayJobFixtures.payWithAuthorization)
    await expect(runner.run(job)).rejects.toBeInstanceOf(WaitForTransactionReceiptTimeoutError)
    const result = await runner.run(handle(job.data, 1))
    expect(chain.sent).toHaveLength(1)
    expect(result).toMatchObject({ txHash: must(chain.sent[0]).hash })
  })
})
