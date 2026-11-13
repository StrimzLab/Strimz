import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { MerchantApiClient } from '@/lib/merchant-api/client'
import { NotificationsResource } from '@/lib/merchant-api/resources/notifications'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const PAGE = 'src/app/(dashboard)/app/notifications/[id]/page.tsx'

// ADR-2026-11-13-broadcast-page-and-dev-invites.
describe('broadcast page', () => {
  it('fetches one broadcast from the merchant API', async () => {
    const get = vi.fn().mockResolvedValue({})
    const resource = new NotificationsResource({ get } as unknown as MerchantApiClient)
    await resource.broadcast('brd_1')
    expect(get).toHaveBeenCalledWith('/v1/notifications/broadcasts/brd_1', undefined)
  })

  it('exists where the tray links and renders only the API-cleaned html', () => {
    expect(existsSync(join(WEB_ROOT, PAGE))).toBe(true)
    const page = read(PAGE)
    expect(page).toMatch(/useNotificationBroadcast\(/u)
    const raw = page.match(/dangerouslySetInnerHTML=\{\{ __html: ([^}]+) \}\}/gu) ?? []
    expect(raw).toEqual(['dangerouslySetInnerHTML={{ __html: broadcast.html }}'])
  })

  it('has loading, error and not-found states', () => {
    const page = read(PAGE)
    expect(page).toMatch(/isPending/u)
    expect(page).toMatch(/isError/u)
    expect(page).toMatch(/isn&apos;t available/u)
  })
})

describe('?highlight= on the lists the tray links to', () => {
  it('lets the data table jump to and outline a row', () => {
    const table = read('src/components/dashboard/data-table.tsx')
    expect(table).toMatch(/highlightRowId\?: string \| null/u)
    expect(table).toMatch(/getRowId/u)
    expect(table).toMatch(/scrollIntoView/u)
    expect(table).toMatch(/setPageIndex/u)
  })

  it.each([
    'src/app/(dashboard)/app/payment-sessions/page.tsx',
    'src/app/(dashboard)/app/subscriptions/page.tsx',
    'src/app/(dashboard)/app/refunds/page.tsx',
  ])('%s passes the highlight param to its table', (path) => {
    const page = read(path)
    expect(page).toMatch(/searchParams\.get\('highlight'\)/u)
    expect(page).toMatch(/highlightRowId=\{/u)
    expect(page).toMatch(/getRowId=\{/u)
  })
})

describe('admin invite link outside production', () => {
  it('shows the accept link with a copy button when the API returns one', () => {
    const page = read('src/app/(admin)/admin/admins/page.tsx')
    expect(page).toMatch(/acceptUrl/u)
    expect(page).toMatch(/navigator\.clipboard\.writeText/u)
    expect(read('src/lib/admin-api/types.ts')).toMatch(/acceptUrl\?: string/u)
  })
})
