import { afterEach, describe, expect, it, vi } from 'vitest'

import { ComplianceService } from '../../../../src/modules/compliance/compliance.service.js'
import type { PrismaService } from '../../../../src/infra/prisma/prisma.service.js'
import type { TypedConfigService } from '../../../../src/config/index.js'

const WALLET = '0x00000000000000000000000000000000000000aa'

function service(): ComplianceService {
  const prisma = {
    db: {
      complianceLog: {
        create: vi.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...data,
            id: 'cl_test',
            createdAt: new Date('2026-10-10T00:00:00Z'),
          }),
        ),
      },
    },
  } as unknown as PrismaService
  const cfg = {
    env: {
      COMPLIANCE_PROVIDER: 'trm',
      COMPLIANCE_API_KEY: 'trm-test-key',
      COMPLIANCE_BLOCK_THRESHOLD: 80,
    },
  } as unknown as TypedConfigService
  return new ComplianceService(prisma, cfg)
}

describe('ComplianceService.screen', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('blocks the wallet when the provider answers with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('down', { status: 503 })))
    const result = await service().screen({ walletAddress: WALLET, context: 'payer_checkout' })
    expect(result.status).toBe('error')
    expect(result.blocked).toBe(true)
  })

  it('blocks the wallet when the provider cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')))
    const result = await service().screen({ walletAddress: WALLET, context: 'payer_checkout' })
    expect(result.status).toBe('error')
    expect(result.blocked).toBe(true)
  })

  it('lets a clear wallet through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json([{ addressRiskIndicators: [], risk: { score: 5 } }])),
    )
    const result = await service().screen({ walletAddress: WALLET, context: 'payer_checkout' })
    expect(result.status).toBe('clear')
    expect(result.blocked).toBe(false)
  })

  it('blocks a wallet at or above the risk threshold', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json([{ addressRiskIndicators: [], risk: { score: 80 } }])),
    )
    const result = await service().screen({ walletAddress: WALLET, context: 'payer_checkout' })
    expect(result.status).toBe('blocked')
    expect(result.blocked).toBe(true)
  })
})
