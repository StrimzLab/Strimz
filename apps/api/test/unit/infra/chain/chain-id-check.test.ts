import { describe, expect, it, vi } from 'vitest'

import type { TypedConfigService } from '../../../../src/config/index.js'
import { ChainService } from '../../../../src/infra/chain/chain.service.js'

function chainService(env: Record<string, unknown>, rpcChainId: number) {
  const cfg = {
    env: { ARC_RPC_URL: 'http://localhost:8545', ...env },
  } as unknown as TypedConfigService
  const service = new ChainService(cfg)
  const getChainId = vi.spyOn(service.client, 'getChainId').mockResolvedValue(rpcChainId)
  return { service, getChainId }
}

describe('API chain id check at boot', () => {
  it('refuses to start in production when the RPC serves another chain', async () => {
    const { service } = chainService(
      { NODE_ENV: 'production', ARC_ENVIRONMENT: 'mainnet' },
      5042002,
    )
    await expect(service.onModuleInit()).rejects.toThrow(
      /5042002[\s\S]*5042\b|5042\b[\s\S]*5042002/u,
    )
  })

  it('starts in production when the RPC serves the expected chain', async () => {
    const { service } = chainService({ NODE_ENV: 'production', ARC_ENVIRONMENT: 'mainnet' }, 5042)
    await expect(service.onModuleInit()).resolves.toBeUndefined()
  })

  it('does not call the RPC outside production', async () => {
    const { service, getChainId } = chainService(
      { NODE_ENV: 'test', ARC_ENVIRONMENT: 'testnet' },
      1,
    )
    await service.onModuleInit()
    expect(getChainId).not.toHaveBeenCalled()
  })
})
