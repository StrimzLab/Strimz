import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')

describe('dashboard payment sessions', () => {
  it('has a session detail page that finds its payment by session id', () => {
    const path = 'src/app/(dashboard)/app/payment-sessions/[id]/page.tsx'
    expect(existsSync(join(WEB_ROOT, path))).toBe(true)
    const detail = read(path)
    expect(detail).toMatch(/useTransactions\(\{\s*sessionId/u)
    expect(detail).toMatch(/<NewRefundDialog[^>]*transaction=\{/u)
  })

  it('creates sessions from the list and links rows to their detail', () => {
    const list = read('src/app/(dashboard)/app/payment-sessions/page.tsx')
    expect(list).toMatch(/<NewPaymentSessionDialog/u)
    expect(list).toMatch(/href=\{`\/app\/payment-sessions\/\$\{/u)
    expect(list).not.toMatch(/via the API or SDK/u)
  })

  it('builds the session request with the tested helper', () => {
    expect(
      read('src/components/dashboard/payment-sessions/new-payment-session-dialog.tsx'),
    ).toMatch(/buildPaymentSessionInput\(/u)
  })

  it('shows formatted amounts in the create toast', () => {
    expect(read('src/hooks/api/use-payment-sessions.ts')).not.toMatch(
      /\$\{s\.amount\} \$\{s\.currency\}/u,
    )
  })

  it('links a transaction to its session', () => {
    expect(read('src/app/(dashboard)/app/transactions/[id]/page.tsx')).toMatch(
      /href=\{`\/app\/payment-sessions\/\$\{tx\.sessionId\}`\}/u,
    )
  })
})
