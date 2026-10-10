import { describe, expect, it } from 'vitest'

import { ComplianceService } from '../../../../src/modules/compliance/compliance.service.js'
import type { PrismaService } from '../../../../src/infra/prisma/prisma.service.js'
import type { TypedConfigService } from '../../../../src/config/index.js'

function config(env: {
  COMPLIANCE_PROVIDER: 'trm' | 'elliptic' | 'disabled'
  COMPLIANCE_API_KEY?: string
}): TypedConfigService {
  return { env: { COMPLIANCE_BLOCK_THRESHOLD: 80, ...env } } as unknown as TypedConfigService
}

const prisma = {} as PrismaService

describe('ComplianceService configuration', () => {
  it.each(['trm', 'elliptic'] as const)(
    'refuses to start with provider %s and no API key',
    (provider) => {
      expect(
        () => new ComplianceService(prisma, config({ COMPLIANCE_PROVIDER: provider })),
      ).toThrow(/COMPLIANCE_API_KEY/u)
    },
  )

  it('starts with screening disabled', () => {
    expect(
      () => new ComplianceService(prisma, config({ COMPLIANCE_PROVIDER: 'disabled' })),
    ).not.toThrow()
  })
})
