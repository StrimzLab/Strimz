import { describe, expect, it } from 'vitest'

import { MerchantChainService } from '../../../../src/modules/merchants/merchant-chain.service.js'
import type { ChainService } from '../../../../src/infra/chain/chain.service.js'
import type { PrismaService } from '../../../../src/infra/prisma/prisma.service.js'
import type { QueueService } from '../../../../src/infra/queue/queue.service.js'
import type { TypedConfigService } from '../../../../src/config/index.js'

const REGISTRY = '0x0000000000000000000000000000000000007777' as const
const ZERO = '0x0000000000000000000000000000000000000000' as const
const OWNER = '0x1111111111111111111111111111111111111111' as const
const PAYOUT = '0x2222222222222222222222222222222222222222' as const
const NOMINEE = '0x3333333333333333333333333333333333333333' as const

type ReadContractArgs = { functionName: string; args?: readonly unknown[] }

function makeService(reads: Record<string, unknown>): MerchantChainService {
  const chain = {
    client: {
      chain: { id: 5042002 },
      readContract(args: ReadContractArgs): Promise<unknown> {
        if (!(args.functionName in reads)) {
          return Promise.reject(new Error(`fake chain: no handler for ${args.functionName}`))
        }
        return Promise.resolve(reads[args.functionName])
      },
    },
  } as unknown as ChainService
  const prisma = {
    db: {
      merchant: {
        findUnique: () => Promise.resolve({ onchainMerchantId: 7 }),
      },
    },
  } as unknown as PrismaService
  const cfg = { env: { STRIMZ_REGISTRY_ADDRESS: REGISTRY } } as unknown as TypedConfigService
  return new MerchantChainService(prisma, chain, {} as QueueService, cfg)
}

function merchantRecord(pendingOwner: `0x${string}`) {
  return {
    owner: OWNER,
    feeBps: 100,
    active: true,
    payoutAddress: PAYOUT,
    parentMerchantId: 0n,
    pendingOwner,
    pendingPayoutAddress: ZERO,
    payoutChangeCommitAt: 0n,
    maxFeeBps: 100,
  }
}

describe('MerchantChainService.getOnchainState', () => {
  it('returns when a pending owner can accept', async () => {
    const svc = makeService({
      getMerchant: merchantRecord(NOMINEE),
      PAYOUT_CHANGE_DELAY: 86_400n,
      pendingOwnerAcceptableAt: 1_790_000_000n,
    })

    const state = await svc.getOnchainState('merchant-1')

    expect(state?.pendingOwner).toBe(NOMINEE)
    expect(state?.pendingOwnerAcceptableAt).toBe(1_790_000_000)
  })

  it('returns null acceptance time when the registry has none recorded', async () => {
    const svc = makeService({
      getMerchant: merchantRecord(NOMINEE),
      PAYOUT_CHANGE_DELAY: 86_400n,
      pendingOwnerAcceptableAt: 0n,
    })

    const state = await svc.getOnchainState('merchant-1')

    expect(state?.pendingOwner).toBe(NOMINEE)
    expect(state?.pendingOwnerAcceptableAt).toBeNull()
  })
})
