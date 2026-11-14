import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { MerchantApiClient } from '@/lib/merchant-api/client'
import { CustomersResource } from '@/lib/merchant-api/resources/customers'
import { InvoicesResource } from '@/lib/merchant-api/resources/invoices'
import { PaymentSessionsResource } from '@/lib/merchant-api/resources/payment-sessions'
import { RefundsResource } from '@/lib/merchant-api/resources/refunds'
import { SubscriptionsResource } from '@/lib/merchant-api/resources/subscriptions'
import { TransactionsResource } from '@/lib/merchant-api/resources/transactions'

const WEB_ROOT = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(WEB_ROOT, path), 'utf8')
const DETAIL = 'src/app/(dashboard)/app/customers/[id]/page.tsx'
const CUSTOMER = 'cmq4wh9de0006je6l2n5v0kqt'

function fakeClient() {
  const get = vi.fn().mockResolvedValue({ data: [], nextCursor: null, hasMore: false })
  return { client: { get } as unknown as MerchantApiClient, get }
}

function sentQuery(get: ReturnType<typeof vi.fn>) {
  return (get.mock.calls[0]?.[1] as { query: Record<string, unknown> }).query
}

describe('customer filters in the dashboard client', () => {
  it.each([
    ['payment sessions', PaymentSessionsResource],
    ['subscriptions', SubscriptionsResource],
    ['transactions', TransactionsResource],
    ['refunds', RefundsResource],
    ['invoices', InvoicesResource],
  ] as const)('%s list sends customerId', async (_name, Resource) => {
    const { client, get } = fakeClient()
    await new Resource(client).list({ customerId: CUSTOMER })
    expect(sentQuery(get).customerId).toBe(CUSTOMER)
  })

  it('customers list sends walletAddress', async () => {
    const { client, get } = fakeClient()
    const wallet = `0x${'ab'.repeat(20)}`
    await new CustomersResource(client).list({ walletAddress: wallet })
    expect(sentQuery(get).walletAddress).toBe(wallet)
  })
})

describe('customer detail page', () => {
  it('exists', () => {
    expect(existsSync(join(WEB_ROOT, DETAIL))).toBe(true)
  })

  it.each([
    'usePaymentSessions',
    'useSubscriptions',
    'useTransactions',
    'useRefunds',
    'useInvoices',
  ])('loads %s for this customer', (hook) => {
    expect(read(DETAIL)).toMatch(new RegExp(`${hook}\\(\\{[^}]*customerId: id`, 'u'))
  })

  it('links each row to its own page', () => {
    const page = read(DETAIL)
    for (const path of [
      '/app/payment-sessions/',
      '/app/subscriptions/',
      '/app/transactions/',
      '/app/invoices/',
    ]) {
      expect(page).toContain(path)
    }
  })

  it('is reachable from the customers list', () => {
    const list = read('src/app/(dashboard)/app/customers/page.tsx')
    expect(list).toMatch(/href=\{`\/app\/customers\/\$\{/u)
    expect(list).toContain('View customer')
  })
})

describe('customers docs match the product', () => {
  const docs = read('content/docs/dashboard/customers.mdx')
  const layout = read('src/app/(dashboard)/app/customers/layout.tsx')

  it.each([
    ['lifetime value', /lifetime value/iu],
    ['most recent email', /most recent email/iu],
    ['every email that wallet has given you', /every email that wallet/iu],
  ])('does not promise %s', (_name, pattern) => {
    expect(docs).not.toMatch(pattern)
    expect(layout).not.toMatch(pattern)
  })

  it('describes the customer page and the wallet lookup', () => {
    expect(docs).toMatch(/customer page/iu)
    expect(docs).toContain('walletAddress')
  })
})
