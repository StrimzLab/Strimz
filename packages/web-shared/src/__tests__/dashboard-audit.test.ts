import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_CAPABILITIES } from '@strimz/shared-config'
import { describe, expect, it } from 'vitest'
import { REPO, readWeb } from './web-source'

const REPO_ROOT = REPO
const read = (path: string) => readWeb(path)
const readRepo = (path: string) => readFileSync(join(REPO_ROOT, path), 'utf8')

// #406: dashboard bugs found before the v1 end-to-end pass.
describe('dashboard audit (#406)', () => {
  it('offers only the transaction kinds the indexer records', () => {
    const page = read('src/app/(dashboard)/app/transactions/page.tsx')
    const kinds = /const KINDS[^=]*=\s*\[([^\]]*)\]/u.exec(page)?.[1] ?? ''
    expect(kinds.match(/'[a-z_]+'/gu)).toEqual(["'one_shot'", "'subscription_charge'"])
  })

  it("links the storefront to this deployment's checkout host, not production", () => {
    const page = read('src/app/(dashboard)/app/storefront/page.tsx')
    expect(page).not.toContain('strimz.finance/store')
    expect(page).toMatch(/siteUrls\.checkout\}\/store/u)
  })

  it.each([
    'src/app/(admin)/admin/page.tsx',
    'src/app/(admin)/admin/analytics/page.tsx',
    'src/app/(admin)/admin/merchants/[id]/page.tsx',
  ])('%s starts in the deployment mode', (path) => {
    const page = read(path)
    expect(page).not.toMatch(/useState<Mode>\('live'\)/u)
    expect(page).toMatch(/useState<Mode>\(useDashboardMode\(\)\)/u)
  })

  it('keeps CCTP routing unavailable and gates its card on that flag', () => {
    expect(AGENT_CAPABILITIES.routing.available).toBe(false)
    const page = read('src/app/(dashboard)/app/agents/page.tsx')
    expect(page).toMatch(/AGENT_CAPABILITIES\.routing\.available/u)
  })

  it.each(['apps/scheduler/.env.example', 'apps/web/.env.example'])(
    '%s ships a working Arc testnet RPC',
    (path) => {
      expect(readRepo(path)).not.toContain('example.com')
      expect(readRepo(path)).toMatch(/ARC_RPC_URL=https:\/\/rpc\.testnet\.arc\.io$/mu)
    },
  )

  it('makes no 2FA claims the app does not back', () => {
    const settings = read('src/app/(dashboard)/app/settings/page.tsx')
    expect(settings).not.toMatch(/href="https:\/\/privy\.io"/u)
    expect(settings).not.toMatch(/2FA|live-mode keys/u)
    expect(read('src/lib/first-run.ts')).not.toMatch(/after MFA/u)
  })
})
