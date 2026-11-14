import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { webPath } from './web-source'

const page = readFileSync(webPath('src/app/(dashboard)/app/refunds/page.tsx'), 'utf8')

// #441: a failed refund says why, so the merchant knows whether to retry.
describe('refunds page failure reason', () => {
  it('shows failureReason under the status of a failed refund', () => {
    const statusCell = page.slice(
      page.indexOf("accessorKey: 'status'"),
      page.indexOf("accessorKey: 'payerAddress'"),
    )
    expect(statusCell).toMatch(/row\.original\.status === 'failed'/u)
    expect(statusCell).toMatch(/row\.original\.failureReason/u)
  })

  it('includes the reason in the CSV export', () => {
    expect(page).toMatch(/\{ key: 'failureReason', header: 'Failure reason' \}/u)
  })
})
