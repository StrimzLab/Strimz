import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { MerchantApiClient } from '../lib/merchant-api/client'
import { TransactionsResource } from '../lib/merchant-api/resources/transactions'
import { readWeb, webTree } from './web-source'

const WEB_ROOT = webTree()
const read = (path: string) => readWeb(path)

describe('dashboard transactions', () => {
  it('has a transactions list and detail page', () => {
    expect(existsSync(join(WEB_ROOT, 'src/app/(dashboard)/app/transactions/page.tsx'))).toBe(true)
    expect(existsSync(join(WEB_ROOT, 'src/app/(dashboard)/app/transactions/[id]/page.tsx'))).toBe(
      true,
    )
  })

  it('lists Transactions in the sidebar and highlights parents on detail pages', () => {
    const sidebar = read('src/components/dashboard/sidebar.tsx')
    expect(sidebar).toMatch(/href: '\/app\/transactions'/u)
    expect(sidebar).toMatch(/startsWith\(`\$\{link\.href\}\/`\)/u)
  })

  it('opens the refund dialog pre-filled from a transaction', () => {
    const detail = read('src/app/(dashboard)/app/transactions/[id]/page.tsx')
    expect(detail).toMatch(/<NewRefundDialog[^>]*transaction=\{/u)
    expect(detail).toMatch(/canRefund\(/u)
  })

  describe('date range filter', () => {
    const page = () => read('src/app/(dashboard)/app/transactions/page.tsx')
    const dateFilter = () => read('src/components/dashboard/filter-bar/date-filter.tsx')

    it('offers the presets and a custom range', () => {
      for (const label of [
        'Any time',
        'Today',
        'Last 7 days',
        'Last 30 days',
        'This month',
        'Last month',
        'Custom',
      ]) {
        expect(dateFilter()).toContain(`'${label}'`)
      }
      expect(dateFilter()).toMatch(/type="date"/u)
      expect(page()).toMatch(/<DateFilter/u)
    })

    it('the dashboard client sends from and to', async () => {
      const get = vi.fn().mockResolvedValue({ data: [], nextCursor: null, hasMore: false })
      const from = '2026-09-01T00:00:00+01:00'
      const to = '2026-10-01T00:00:00+01:00'
      await new TransactionsResource({ get } as unknown as MerchantApiClient).list({ from, to })
      expect(get.mock.calls[0]?.[1]).toMatchObject({ query: { from, to } })
    })

    it('sends from and to from the tested helper', () => {
      expect(read('src/components/dashboard/filter-bar/use-date-range.ts')).toMatch(
        /resolveDateRange\(/u,
      )
      expect(page()).toMatch(/useDateRange\(/u)
      expect(page()).toMatch(/from: [^\n]*\.from/u)
      expect(page()).toMatch(/to: [^\n]*\.to/u)
    })

    it('names the time zone the dates use', () => {
      expect(dateFilter()).toMatch(/timeZoneName\(\)/u)
    })

    it('shows the invalid range error with role="alert"', () => {
      expect(dateFilter()).toMatch(/role="alert"/u)
    })

    it('says when filters empty the list and offers to clear them', () => {
      expect(page()).toContain('No transactions match these filters')
      expect(read('src/components/dashboard/data-table.tsx')).toContain('Clear filters')
    })

    it('names the export after the range', () => {
      expect(page()).toMatch(/const fileName = rangeFileName\('transactions', range\)/u)
      expect(page()).toMatch(/downloadCsv\(fileName,/u)
    })
  })

  it('builds the refund request with the tested helper', () => {
    expect(read('src/components/dashboard/refunds/new-refund-dialog.tsx')).toMatch(
      /buildRefundInput\(/u,
    )
  })
})
