import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

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

  it('builds the refund request with the tested helper', () => {
    expect(read('src/components/dashboard/refunds/new-refund-dialog.tsx')).toMatch(
      /buildRefundInput\(/u,
    )
  })
})
