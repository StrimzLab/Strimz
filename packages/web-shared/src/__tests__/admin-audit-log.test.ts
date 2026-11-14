import { describe, expect, it } from 'vitest'
import { readWeb, webExists } from './web-source'

const read = (path: string) => readWeb(path)
const PAGE = 'src/app/(admin)/admin/audit-log/page.tsx'

// ADR-2026-11-13-admin-audit-log (#260).
describe('admin audit log page', () => {
  it('exists and reads the audit log through the admin client', () => {
    expect(webExists(PAGE)).toBe(true)
    expect(read(PAGE)).toMatch(/useAdminAuditLog\(/u)
    expect(read('src/lib/admin-api/client.ts')).toMatch(/'\/v1\/admin\/audit-log'/u)
  })

  it('filters by category, source and date', () => {
    const page = read(PAGE)
    expect(page).toMatch(/label="Category"/u)
    expect(page).toMatch(/label="Source"/u)
    expect(page).toMatch(/<DateFilter/u)
  })

  it('links on-chain rows to the explorer and shows alert state', () => {
    const page = read(PAGE)
    expect(page).toMatch(/arcExplorerTxUrl\(/u)
    expect(page).toMatch(/Alert emailed/u)
    expect(page).toMatch(/Alert pending/u)
  })

  it('has loading, empty, error and load-more states', () => {
    const page = read(PAGE)
    expect(page).toMatch(/isPending/u)
    expect(page).toMatch(/Nothing recorded/u)
    expect(page).toMatch(/Couldn&apos;t load the audit log/u)
    expect(page).toMatch(/fetchNextPage/u)
  })

  it('appears in the admin nav for admins but not read-only admins', () => {
    const shell = read('src/components/admin/admin-shell.tsx')
    expect(shell).toMatch(/href: '\/admin\/audit-log'/u)
    expect(shell).toMatch(/roles: \['super_admin', 'admin'\]/u)
  })
})
