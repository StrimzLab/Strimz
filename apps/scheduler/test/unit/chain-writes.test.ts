import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decodeFunctionData,
  encodeAbiParameters,
  keccak256,
  parseAbi,
  parseGwei,
  parseTransaction,
  toHex,
  type Hex,
} from 'viem'
import { SoftwareSigner } from '@strimz/signer'

import type { TypedConfigService } from '../../src/config/index.js'
import { ChainService } from '../../src/infra/chain/chain.service.js'
import { must } from '../helpers/must.js'

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://strimz:strimz@localhost:5432/strimz',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    ARC_RPC_URL: process.env.ARC_RPC_URL ?? 'http://localhost:8545',
    SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
    AGENT_ESCROW_ADDRESS: '0x0000000000000000000000000000000000000002',
    REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000003',
    STRIMZ_WEBHOOK_SIGNING_SECRET: 'test-webhook-secret-at-least-32-chars-long',
    WEBHOOK_SECRET_ENCRYPTION_KEY: 'ab'.repeat(32),
    RELAYER_ADDRESS: '0x000000000000000000000000000000000000dEaD',
    STRIMZ_ADMIN_ALERT_EMAIL: 'ops@strimz.test',
    SCHEDULER_PRIVATE_KEY:
      process.env.SCHEDULER_PRIVATE_KEY ??
      '0x00000000000000000000000000000000000000000000000000000000000000a1',
  })
})

const PENDING_NONCE = 7
const ATTEMPT = `0x${'0'.repeat(63)}1` as const

interface RpcRequest {
  id: number
  method: string
  params: unknown[]
}

const REGISTRY = '0x0000000000000000000000000000000000000003'
const registryAbi = parseAbi(['function setFeeBps(uint256 merchantId, uint16 newFeeBps)'])

class FakeArcRpc {
  chainId = 5042002
  receiptStatus: '0x1' | '0x0' = '0x1'
  registryFeeBps = 0
  readonly sent: Hex[] = []
  readonly calls: { to: string; data: Hex }[] = []
  private server: Server | undefined

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk: Buffer) => (body += chunk.toString()))
      req.on('end', () => {
        const parsed = JSON.parse(body) as RpcRequest | RpcRequest[]
        const reply = Array.isArray(parsed)
          ? parsed.map((r) => this.answer(r))
          : this.answer(parsed)
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(reply))
      })
    })
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${(this.server?.address() as AddressInfo).port}`
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server?.close(() => resolve()))
  }

  private answer(req: RpcRequest) {
    const result = this.result(req)
    if (result === undefined) {
      return {
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32601, message: `the method ${req.method} does not exist` },
      }
    }
    return { jsonrpc: '2.0', id: req.id, result }
  }

  private result(req: RpcRequest): unknown {
    switch (req.method) {
      case 'eth_chainId':
        return toHex(this.chainId)
      case 'eth_getTransactionCount':
        return toHex(PENDING_NONCE)
      case 'eth_estimateGas':
        return toHex(100_000)
      case 'eth_maxPriorityFeePerGas':
        return toHex(parseGwei('1'))
      case 'eth_gasPrice':
        return toHex(parseGwei('20'))
      case 'eth_getBlockByNumber':
        return { number: toHex(1), baseFeePerGas: toHex(parseGwei('20')), timestamp: toHex(1) }
      case 'eth_blockNumber':
        return toHex(2)
      case 'eth_getTransactionReceipt': {
        const hash = req.params[0] as Hex
        return {
          transactionHash: hash,
          transactionIndex: '0x0',
          blockHash: `0x${'b'.repeat(64)}`,
          blockNumber: toHex(2),
          from: '0x0000000000000000000000000000000000000001',
          to: REGISTRY,
          cumulativeGasUsed: toHex(40_000),
          gasUsed: toHex(40_000),
          effectiveGasPrice: toHex(parseGwei('20')),
          contractAddress: null,
          logs: [],
          logsBloom: `0x${'0'.repeat(512)}`,
          status: this.receiptStatus,
          type: '0x2',
        }
      }
      case 'eth_call': {
        const call = req.params[0] as { to: string; data: Hex }
        this.calls.push(call)
        const zero = '0x0000000000000000000000000000000000000000'
        return encodeAbiParameters(
          [
            {
              type: 'tuple',
              components: [
                { type: 'address' },
                { type: 'uint16' },
                { type: 'bool' },
                { type: 'address' },
                { type: 'uint256' },
                { type: 'address' },
                { type: 'address' },
                { type: 'uint64' },
                { type: 'uint16' },
              ],
            },
          ],
          [[zero, this.registryFeeBps, true, zero, 0n, zero, zero, 0n, 50]],
        )
      }
      case 'eth_sendRawTransaction': {
        const raw = req.params[0] as Hex
        this.sent.push(raw)
        return keccak256(raw)
      }
      default:
        return undefined
    }
  }
}

const rpc = new FakeArcRpc()
let rpcUrl = ''

beforeAll(async () => {
  rpcUrl = await rpc.start()
})

afterAll(() => rpc.stop())

beforeEach(() => {
  rpc.sent.length = 0
  rpc.calls.length = 0
  rpc.chainId = 5042002
  rpc.receiptStatus = '0x1'
  rpc.registryFeeBps = 0
})

function chainService(): ChainService {
  const cfg = {
    env: {
      NODE_ENV: 'test',
      ARC_ENVIRONMENT: 'testnet',
      ARC_RPC_URL: rpcUrl,
      SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
      AGENT_ESCROW_ADDRESS: '0x0000000000000000000000000000000000000002',
      REGISTRY_ADDRESS: REGISTRY,
    },
  } as unknown as TypedConfigService
  const signer = new SoftwareSigner(
    '0x00000000000000000000000000000000000000000000000000000000000000a1',
  )
  return new ChainService(cfg, signer)
}

describe('scheduler chain writes', () => {
  it('gives concurrent writes consecutive nonces', async () => {
    const chain = chainService()
    await Promise.all([chain.batchCharge([1n], [ATTEMPT]), chain.batchCharge([2n], [ATTEMPT])])
    const nonces = rpc.sent.map((raw) => parseTransaction(raw).nonce).sort()
    expect(nonces).toEqual([PENDING_NONCE, PENDING_NONCE + 1])
  })

  it('signs every write for the configured chain', async () => {
    const chain = chainService()
    await chain.cancelSubscription(3n)
    expect(rpc.sent.map((raw) => parseTransaction(raw).chainId)).toEqual([5042002])
  })

  it('signs for the configured chain even when the RPC reports another', async () => {
    rpc.chainId = 1
    const chain = chainService()
    await chain.cancelSubscription(3n)
    expect(rpc.sent.map((raw) => parseTransaction(raw).chainId)).toEqual([5042002])
  })

  it('sets a merchant fee on the registry and returns once the receipt succeeds', async () => {
    const chain = chainService()

    const hash = await chain.setMerchantFeeBps(7n, 50)

    expect(rpc.sent).toHaveLength(1)
    const tx = parseTransaction(must(rpc.sent[0]))
    expect(tx.to).toBe(REGISTRY)
    const call = decodeFunctionData({ abi: registryAbi, data: must(tx.data) })
    expect(call.functionName).toBe('setFeeBps')
    expect(call.args).toEqual([7n, 50])
    expect(hash).toBe(keccak256(must(rpc.sent[0])))
  })

  it('throws when the fee change reverts', async () => {
    rpc.receiptStatus = '0x0'
    const chain = chainService()
    await expect(chain.setMerchantFeeBps(7n, 50)).rejects.toThrow(/reverted/u)
  })

  it('reads a merchant fee from the registry', async () => {
    rpc.registryFeeBps = 40
    const chain = chainService()

    expect(await chain.readMerchantFeeBps(7n)).toBe(40)
    expect(rpc.calls.map((c) => c.to.toLowerCase())).toEqual([REGISTRY])
  })
})
