import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')

describe('dashboard sections locked by plan', () => {
  it('shows the storefront builder only when the plan includes it', () => {
    const page = read('src/app/(dashboard)/app/storefront/page.tsx')
    expect(page).toMatch(/planIncludes\([^)]*'storefront'\)/u)
    expect(page).toMatch(/<PlanLockedNotice feature="storefront"/u)
  })

  it('shows anomaly and yield controls only when the plan includes them', () => {
    const dialog = read('src/components/dashboard/agents/settings-dialogs.tsx')
    expect(dialog).toMatch(/planIncludes\([^)]*'anomaly_alerts'\)/u)
    expect(dialog).toMatch(/planIncludes\([^)]*'yield_recommendations'\)/u)
    expect(dialog).toMatch(/<PlanLockedNotice/u)
  })

  it('shows the plan, its fee and the next automatic step in settings', () => {
    const settings = read('src/app/(dashboard)/app/settings/page.tsx')
    expect(settings).toMatch(/planFeeLabel\(/u)
    expect(settings).toMatch(/nextPlanNotice\(/u)
    expect(settings).toMatch(/PLANS\[merchant\.tier\]\.name/u)
  })
})
