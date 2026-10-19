import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import config from '../../next.config.mjs'
import { CASE_STUDIES, namedCaseStudies } from '@/components/marketing/use-cases/case-studies'
import { USE_CASES, sampleCost } from '@/components/marketing/use-cases/data'
import { firstYearFees } from '@/lib/fee-estimate'

const WEB_ROOT = fileURLToPath(new URL('../..', import.meta.url))

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.tsx?$/u.test(name) ? [path] : []
  })
}

describe('use cases', () => {
  it('covers each audience once, in order', () => {
    expect(USE_CASES.map((u) => u.id)).toEqual([
      'saas',
      'marketplaces',
      'creators',
      'agencies',
      'global-b2b',
    ])
  })

  it('names three features per audience, each linked to a guide', () => {
    for (const useCase of USE_CASES) {
      expect(useCase.features).toHaveLength(3)
      for (const feature of useCase.features) expect(feature.href).toMatch(/^\/docs\//u)
    }
  })

  it('works every sample cost out with the fee estimate', () => {
    for (const { sample } of USE_CASES) {
      const year = firstYearFees(sample.monthlyVolume)
      expect(sampleCost(sample)).toEqual({ fees: year.fees, effectiveRate: year.effectiveRate })
      expect(sample.monthlyVolume).toBe(sample.count * sample.unitAmount)
    }
  })

  it('tells marketplaces that seller payouts are not split', () => {
    const marketplaces = USE_CASES.find((u) => u.id === 'marketplaces')
    expect(marketplaces?.limit).toMatch(/does not split payouts/u)
  })
})

describe('case studies', () => {
  it('show only entries with a real name, role and company', () => {
    expect(
      namedCaseStudies([
        { quote: 'q', name: null, role: null, company: null, sector: 'SaaS' },
        { quote: 'q', name: 'A', role: 'Founder', company: 'B', sector: 'SaaS' },
      ]),
    ).toHaveLength(1)
  })

  it('have none to show yet', () => {
    expect(namedCaseStudies(CASE_STUDIES)).toEqual([])
  })
})

describe('the customers page moved to use cases', () => {
  it('redirects /customers permanently', async () => {
    const rules = (await config.redirects?.()) ?? []
    const rule = rules.find((r) => r.source === '/customers')
    expect(rule).toMatchObject({ destination: '/use-cases', permanent: true })
  })

  it('is linked as Use cases and nothing links to /customers', () => {
    const marketing = [
      ...files(join(WEB_ROOT, 'src/components/marketing')),
      ...files(join(WEB_ROOT, 'src/app/(marketing)')),
    ]
    const stale = marketing
      .filter((file) => /href[:=]\s*['"{`]+\/customers['"`]/u.test(readFileSync(file, 'utf8')))
      .map((file) => relative(WEB_ROOT, file))
    expect(stale).toEqual([])
    const nav = readFileSync(join(WEB_ROOT, 'src/components/marketing/nav.tsx'), 'utf8')
    expect(nav).toContain("{ href: '/use-cases', label: 'Use cases' }")
  })
})
