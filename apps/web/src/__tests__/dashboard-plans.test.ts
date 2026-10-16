import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const exists = (path: string) => existsSync(join(WEB_ROOT, path))

describe('dashboard plans and subscriptions', () => {
  it('has plans, plan detail and subscription detail pages', () => {
    expect(exists('src/app/(dashboard)/app/plans/page.tsx')).toBe(true)
    expect(exists('src/app/(dashboard)/app/plans/[id]/page.tsx')).toBe(true)
    expect(exists('src/app/(dashboard)/app/subscriptions/[id]/page.tsx')).toBe(true)
  })

  it('lists Plans in the sidebar', () => {
    expect(read('src/components/dashboard/sidebar.tsx')).toMatch(/href: '\/app\/plans'/u)
  })

  it('creates plans with the tested builder and archives them with a confirmation', () => {
    expect(read('src/components/dashboard/plans/new-plan-dialog.tsx')).toMatch(/buildPlanInput\(/u)
    expect(read('src/app/(dashboard)/app/plans/page.tsx')).toMatch(/<NewPlanDialog/u)
    expect(read('src/app/(dashboard)/app/plans/[id]/page.tsx')).toMatch(/archivePlanConfirm\(/u)
  })

  it('shows the plan sign-up link and its subscribers', () => {
    const plan = read('src/app/(dashboard)/app/plans/[id]/page.tsx')
    expect(plan).toMatch(/\/sub\/\$\{plan\.id\}/u)
    expect(plan).toMatch(/useSubscriptions\(\{\s*planId/u)
  })

  it("shows a subscription's charges and lets the merchant cancel it", () => {
    const sub = read('src/app/(dashboard)/app/subscriptions/[id]/page.tsx')
    expect(sub).toMatch(/useTransactions\(\{\s*subscriptionId/u)
    expect(sub).toMatch(/cancelSubscriptionConfirm\(/u)
  })

  it('shows plan names in the subscriptions list and links rows to their detail', () => {
    const list = read('src/app/(dashboard)/app/subscriptions/page.tsx')
    expect(list).toMatch(/useSubscriptionPlans\(/u)
    expect(list).toMatch(/href=\{`\/app\/subscriptions\/\$\{/u)
  })

  it('points the storefront plan picker at the Plans page', () => {
    expect(read('src/app/(dashboard)/app/storefront/page.tsx')).toMatch(/href="\/app\/plans"/u)
  })

  it('patches paginated plan lists when archiving', () => {
    expect(read('src/hooks/api/use-subscription-plans.ts')).toMatch(/patchListCacheRow\(/u)
  })
})
