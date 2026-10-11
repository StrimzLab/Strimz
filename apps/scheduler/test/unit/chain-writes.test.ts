import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { keccak256, parseGwei, parseTransaction, toHex, type Hex } from 'viem'
import { SoftwareSigner } from '@strimz/signer'

import type { TypedConfigService } from '../../src/config/index.js'
import { ChainService } from '../../src/infra/chain/chain.service.js'

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://strimz:strimz@localhost:5432/strimz',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    ARC_RPC_URL: process.env.ARC_RPC_URL ?? 'http://localhost:8545',
    SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
    AGENT_ESCROW_ADDRESS: '0x0000000000000000000000000000000000000002',
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

class FakeArcRpc {
  chainId = 5042002
  readonly sent: Hex[] = []
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
  rpc.chainId = 5042002
})

function chainService(): ChainService {
  const cfg = {
    env: {
      NODE_ENV: 'test',
      ARC_ENVIRONMENT: 'testnet',
      ARC_RPC_URL: rpcUrl,
      SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
      AGENT_ESCROW_ADDRESS: '0x0000000000000000000000000000000000000002',
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
})
