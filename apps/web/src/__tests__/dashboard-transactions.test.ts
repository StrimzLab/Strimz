import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { MerchantApiClient } from '@/lib/merchant-api/client'
import { TransactionsResource } from '@/lib/merchant-api/resources/transactions'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')

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

    it('offers the presets and a custom range', () => {
      for (const label of ['Any time', 'Last 7 days', 'This month', 'Last month', 'Custom']) {
        expect(page()).toContain(`'${label}'`)
      }
      expect(page()).toMatch(/type="date"/u)
    })

    it('the dashboard client sends from and to', async () => {
      const get = vi.fn().mockResolvedValue({ data: [], nextCursor: null, hasMore: false })
      const from = '2026-09-01T00:00:00+01:00'
      const to = '2026-10-01T00:00:00+01:00'
      await new TransactionsResource({ get } as unknown as MerchantApiClient).list({ from, to })
      expect(get.mock.calls[0]?.[1]).toMatchObject({ query: { from, to } })
    })

    it('sends from and to from the tested helper', () => {
      expect(page()).toMatch(/resolveDateRange\(/u)
      expect(page()).toMatch(/from: [^\n]*\.from/u)
      expect(page()).toMatch(/to: [^\n]*\.to/u)
    })

    it('names the time zone the dates use', () => {
      expect(page()).toMatch(/timeZoneName\(\)/u)
    })

    it('shows the invalid range error with role="alert"', () => {
      expect(page()).toMatch(/role="alert"/u)
    })

    it('says when filters empty the list and offers to clear them', () => {
      expect(page()).toContain('No transactions match these filters')
      expect(page()).toContain('Clear filters')
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
